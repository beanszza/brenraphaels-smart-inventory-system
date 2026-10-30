"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/receiving/mutate";
import { notifyRequester } from "@/lib/receiving/notify";
import type { ReceiptInput } from "@/lib/receiving/inputs";

const MODULE = "Goods Receiving";

export async function listReceipts(query = "") {
  await requireModule(MODULE);
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const poId = searchParams.get("poId");
    const deliveryId = searchParams.get("deliveryId");
    const status = searchParams.get("status") || "All";

    const where: import("@prisma/client").Prisma.GoodsReceiptsWhereInput = {};
    if (poId) {
      where.PoId = positiveId(poId);
    }
    if (deliveryId) {
      where.DeliveryId = positiveId(deliveryId);
    }
    if (status !== "All") {
      where.Status = status;
    }

    const grns = await prisma.goodsReceipts.findMany({
      where,
      orderBy: { CreatedAt: "desc" },
      include: {
        Deliveries: { include: { PurchaseOrders: { include: { Suppliers: true } } } },
        GoodsReceiptItems: {
          include: { Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }, UnitOfMeasures: true }
        }
      }
    });

    const data = grns.map(g => ({
      grnId: g.GrnId,
      grnNumber: g.GrnNumber,
      poId: g.PoId,
      poNumber: g.Deliveries?.PurchaseOrders?.PoNumber,
      deliveryId: g.DeliveryId,
      deliveryNumber: g.Deliveries?.DeliveryNumber,
      supplierId: g.Deliveries?.PurchaseOrders?.SupplierId,
      supplierName: g.Deliveries?.PurchaseOrders?.Suppliers?.CompanyName || "",
      status: g.Status,
      receivedDate: g.ReceivedDate,
      receivedBy: g.ReceivedBy,
      notes: g.Notes,
      createdAt: g.CreatedAt,
      items: g.GoodsReceiptItems.map(i => ({
        grnItemId: i.GrnItemId,
        itemId: i.ItemId,
        itemName: i.Items?.ItemName || "",
        poItemId: i.PoItemId,
        orderedQuantity: Number(i.OrderedQuantity),
        previouslyReceivedQuantity: Number(i.PreviouslyReceivedQuantity),
        declaredQuantity: i.DeclaredQuantity == null ? null : Number(i.DeclaredQuantity),
        deliveredQuantity: Number(i.DeliveredQuantity),
        varianceQuantity: Number(i.VarianceQuantity),
        varianceType: i.VarianceType,
        deliveryItemId: i.DeliveryItemId,
        purchaseUomId: i.PurchaseUomId,
        purchaseUomName: i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
        supplierLotCode: i.SupplierLotCode || undefined,
        manufactureDate: i.ManufactureDate ? i.ManufactureDate.toISOString() : undefined,
        expiryDate: i.ExpiryDate ? i.ExpiryDate.toISOString() : undefined,
        notes: i.Notes || undefined
      }))
    }));

    return resourceResult({ success: true, data });

  });
}

export async function createReceipt(body: ReceiptInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    validateInput(body);

    const delivery = await tx.deliveries.findUnique({
      where: { DeliveryId: body.deliveryId },
      include: { PurchaseOrders: { include: { PurchaseOrderItems: true } }, DeliveryItems: true }
    });

    if (!delivery) {
      return refuse(`Delivery ${body.deliveryId} not found.`);
    }

    if (delivery.Status !== "Arrived") {
      return refuse(`Only Arrived deliveries can have a Goods Receipt Note created. Current status: ${delivery.Status}.`);
    }

    // Check if GRN already exists for this delivery (not cancelled/rejected)
    const existing = await tx.goodsReceipts.findFirst({
      where: { DeliveryId: body.deliveryId, Status: { notIn: ["Cancelled", "Rejected"] } }
    });
    if (existing) {
      if (existing.Status === "Draft") {
        await tx.qualityInspectionItems.deleteMany({
          where: { QualityInspections: { ReferenceType: "GRN", ReferenceId: existing.GrnId } },
        });
        await tx.qualityInspections.deleteMany({
          where: { ReferenceType: "GRN", ReferenceId: existing.GrnId },
        });
        await tx.goodsReceiptItems.deleteMany({
          where: { GrnId: existing.GrnId },
        });
        await tx.goodsReceipts.delete({
          where: { GrnId: existing.GrnId },
        });
      } else {
        return refuse(`An active GRN already exists for this delivery.`);
      }
    }

    if (!body.items || body.items.length === 0) {
      return refuse("GRN must contain at least one item.");
    }

    const year = new Date().getFullYear();
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "GoodsReceiptNote", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "GoodsReceiptNote", Year: year, LastNumber: 1 },
    });
    const grnNumber = `GRN-${year}-${String(seq.LastNumber).padStart(4, '0')}`;

    let receivingLocation =
      (await tx.locations.findFirst({
        where: { IsSystemLocation: true, LocationType: "Warehouse", IsActive: true },
      })) ??
      (await tx.locations.findFirst({
        where: { LocationType: "Warehouse", IsActive: true },
      })) ??
      (await tx.locations.findFirst({
        where: { IsSystemLocation: true, IsActive: true },
      }));
    if (!receivingLocation) {
      receivingLocation = await tx.locations.create({
        data: {
          LocationName: "Main Warehouse",
          LocationType: "Warehouse",
          Status: "Active",
          Address: "Commissary",
          IsActive: true,
          IsSystemLocation: true,
        },
      });
    }

    const grnItems = [];
    for (const itemReq of body.items) {
      const delItem = delivery.DeliveryItems.find(i =>
        itemReq.deliveryItemId ? i.DeliveryItemId === itemReq.deliveryItemId : i.ItemId === itemReq.itemId
      );
      if (!delItem) {
        return refuse(`Item ${itemReq.itemId} was not in the delivery shipment.`);
      }

      const poItem = delivery.PurchaseOrders.PurchaseOrderItems.find(i => i.PoItemId === delItem.PoItemId);
      if (!poItem || (itemReq.poItemId && itemReq.poItemId !== poItem.PoItemId)) {
        return refuse("Every GRN line must match its delivery and purchase-order line.");
      }

      const declared = Number(delItem.DeclaredQuantity);
      const delivered = Number(itemReq.deliveredQuantity ?? itemReq.actualReceivedQuantity ?? 0);

      if (delivered < 0) {
        return refuse(`Actual received quantity cannot be negative.`);
      }

      const variance = delivered - declared;

      grnItems.push({
        PoItemId: poItem.PoItemId,
        ItemId: delItem.ItemId,
        OrderedQuantity: poItem.PoItemQuantity,
        PreviouslyReceivedQuantity: 0,
        DeclaredQuantity: declared,
        DeliveredQuantity: delivered,
        VarianceQuantity: Math.abs(variance),
        VarianceType: variance < 0 ? "Short" : variance > 0 ? "Over" : "Exact",
        DeliveryItemId: delItem.DeliveryItemId,
        PurchaseUomId: poItem.PurchaseUomId,
        SupplierLotCode: itemReq.supplierLotCode?.trim() || null,
        ManufactureDate: itemReq.manufactureDate ? new Date(itemReq.manufactureDate) : null,
        ExpiryDate: itemReq.expiryDate ? new Date(itemReq.expiryDate) : null,
        Notes: itemReq.notes?.trim() || null,
      });
    }

    const newGrn = await tx.goodsReceipts.create({
      data: {
        GrnNumber: grnNumber,
        PoId: delivery.PoId,
        DeliveryId: delivery.DeliveryId,
        SupplierId: delivery.SupplierId,
        ReceivingLocationId: receivingLocation.LocationId,
        Status: "Draft",
        ReceivedDate: new Date(),
        DeliveryNoteNumber: body.deliveryNoteNumber?.trim() || delivery.DeliveryNoteNumber || grnNumber,
        SupplierDrNumber: body.supplierDrNumber?.trim() || null,
        SupplierInvoiceNumber: body.supplierInvoiceNumber?.trim() || null,
        ReceivingBay: body.receivingBay?.trim() || null,
        Carrier: body.carrier?.trim() || delivery.Carrier,
        ReceivedBy: staff.username,
        CreatedBy: staff.username,
        Notes: body.notes?.trim(),
        CreatedAt: new Date(),
        GoodsReceiptItems: {
          create: grnItems
        }
      },
      include: {
        Deliveries: { include: { PurchaseOrders: { include: { Suppliers: true } } } },
        GoodsReceiptItems: {
          include: { Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }, UnitOfMeasures: true }
        }
      }
    });

    const response = {
      grnId: newGrn.GrnId,
      grnNumber: newGrn.GrnNumber,
      poId: newGrn.PoId,
      poNumber: newGrn.Deliveries?.PurchaseOrders?.PoNumber,
      deliveryId: newGrn.DeliveryId,
      deliveryNumber: newGrn.Deliveries?.DeliveryNumber,
      supplierId: newGrn.Deliveries?.PurchaseOrders?.SupplierId,
      supplierName: newGrn.Deliveries?.PurchaseOrders?.Suppliers?.CompanyName || "",
      status: newGrn.Status,
      receivedDate: newGrn.ReceivedDate,
      receivedBy: newGrn.ReceivedBy,
      notes: newGrn.Notes,
      createdAt: newGrn.CreatedAt,
      items: newGrn.GoodsReceiptItems.map(i => ({
        grnItemId: i.GrnItemId,
        itemId: i.ItemId,
        itemName: i.Items?.ItemName || "",
        poItemId: i.PoItemId,
        orderedQuantity: Number(i.OrderedQuantity),
        previouslyReceivedQuantity: Number(i.PreviouslyReceivedQuantity),
        declaredQuantity: i.DeclaredQuantity == null ? null : Number(i.DeclaredQuantity),
        deliveredQuantity: Number(i.DeliveredQuantity),
        varianceQuantity: Number(i.VarianceQuantity),
        varianceType: i.VarianceType,
        deliveryItemId: i.DeliveryItemId,
        purchaseUomId: i.PurchaseUomId,
        purchaseUomName: i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
        supplierLotCode: i.SupplierLotCode || undefined,
        manufactureDate: i.ManufactureDate ? i.ManufactureDate.toISOString() : undefined,
        expiryDate: i.ExpiryDate ? i.ExpiryDate.toISOString() : undefined,
        notes: i.Notes || undefined
      }))
    };

    return { result: resourceResult({ success: true, message: "Draft GRN created successfully.", data: response }), audit: { module: MODULE, change: "created", target: { type: "goods-receipt", id: newGrn.GrnId, name: newGrn.GrnNumber }, description: `${staff.name} created goods receipt ${newGrn.GrnNumber}` } };

  });
}

export async function getReceipt(idInput: string | number) {
  await requireModule(MODULE);
  return read(async () => {
    const id = positiveId(idInput);
    const grn = await prisma.goodsReceipts.findUnique({
      where: { GrnId: id },
      include: {
        Deliveries: { include: { PurchaseOrders: { include: { Suppliers: true } } } },
        GoodsReceiptItems: {
          include: { Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }, UnitOfMeasures: true }
        }
      }
    });

    if (!grn) {
      return refuse(`Goods Receipt Note ${id} not found.`);
    }

    const data = {
      grnId: grn.GrnId,
      grnNumber: grn.GrnNumber,
      poId: grn.PoId,
      poNumber: grn.Deliveries?.PurchaseOrders?.PoNumber,
      deliveryId: grn.DeliveryId,
      deliveryNumber: grn.Deliveries?.DeliveryNumber,
      supplierId: grn.Deliveries?.PurchaseOrders?.SupplierId,
      supplierName: grn.Deliveries?.PurchaseOrders?.Suppliers?.CompanyName || "",
      status: grn.Status,
      receivedDate: grn.ReceivedDate,
      receivedBy: grn.ReceivedBy,
      notes: grn.Notes,
      createdAt: grn.CreatedAt,
      items: grn.GoodsReceiptItems.map(i => ({
        grnItemId: i.GrnItemId,
        itemId: i.ItemId,
        itemName: i.Items?.ItemName || "",
        poItemId: i.PoItemId,
        orderedQuantity: Number(i.OrderedQuantity),
        previouslyReceivedQuantity: Number(i.PreviouslyReceivedQuantity),
        declaredQuantity: i.DeclaredQuantity == null ? null : Number(i.DeclaredQuantity),
        deliveredQuantity: Number(i.DeliveredQuantity),
        varianceQuantity: Number(i.VarianceQuantity),
        varianceType: i.VarianceType,
        deliveryItemId: i.DeliveryItemId,
        purchaseUomId: i.PurchaseUomId,
        purchaseUomName: i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
        supplierLotCode: i.SupplierLotCode || undefined,
        manufactureDate: i.ManufactureDate ? i.ManufactureDate.toISOString() : undefined,
        expiryDate: i.ExpiryDate ? i.ExpiryDate.toISOString() : undefined,
        notes: i.Notes || undefined
      }))
    };

    return resourceResult({ success: true, data });

  });
}

export async function updateReceipt(idInput: string | number, body: ReceiptInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const grn = await tx.goodsReceipts.findUnique({
      where: { GrnId: id },
      include: { GoodsReceiptItems: true, Deliveries: { include: { DeliveryItems: true, PurchaseOrders: { include: { PurchaseOrderItems: true } } } } }
    });

    if (!grn) {
      return refuse(`Goods Receipt Note ${id} not found.`);
    }

    if (grn.Status !== "Draft") {
      return refuse(`Only Draft GRNs can be edited. Current status: ${grn.Status}.`);
    }

    if (!body.items || body.items.length === 0) {
      return refuse("GRN must contain at least one item.");
    }

    const grnItems = [];
    for (const itemReq of body.items) {
      const oldItem = grn.GoodsReceiptItems?.find(i =>
        itemReq.deliveryItemId ? i.DeliveryItemId === itemReq.deliveryItemId : i.ItemId === itemReq.itemId
      );
      const delItem = grn.Deliveries?.DeliveryItems?.find(i =>
        itemReq.deliveryItemId ? i.DeliveryItemId === itemReq.deliveryItemId : i.ItemId === itemReq.itemId
      );
      const poItem = grn.Deliveries?.PurchaseOrders?.PurchaseOrderItems?.find(i =>
        delItem ? i.PoItemId === delItem.PoItemId : i.ItemId === itemReq.itemId
      );

      if (!oldItem && !delItem) {
        return refuse(`Item ${itemReq.itemId} is not part of this GRN.`);
      }

      const declared = oldItem?.DeclaredQuantity != null
        ? Number(oldItem.DeclaredQuantity)
        : Number(delItem?.DeclaredQuantity ?? 0);
      const delivered = Number(itemReq.deliveredQuantity ?? itemReq.actualReceivedQuantity ?? 0);

      if (delivered < 0) {
        return refuse(`Actual received quantity cannot be negative.`);
      }

      const variance = delivered - declared;

      grnItems.push({
        PoItemId: oldItem?.PoItemId ?? poItem?.PoItemId ?? itemReq.poItemId!,
        ItemId: oldItem?.ItemId ?? delItem!.ItemId,
        OrderedQuantity: oldItem?.OrderedQuantity ?? poItem?.PoItemQuantity ?? declared,
        PreviouslyReceivedQuantity: oldItem?.PreviouslyReceivedQuantity ?? 0,
        DeclaredQuantity: declared,
        DeliveredQuantity: delivered,
        VarianceQuantity: Math.abs(variance),
        VarianceType: variance < 0 ? "Short" : variance > 0 ? "Over" : "Exact",
        DeliveryItemId: oldItem?.DeliveryItemId ?? delItem?.DeliveryItemId ?? itemReq.deliveryItemId ?? null,
        PurchaseUomId: oldItem?.PurchaseUomId ?? poItem?.PurchaseUomId ?? 1,
        SupplierLotCode: itemReq.supplierLotCode?.trim() || oldItem?.SupplierLotCode || null,
        ManufactureDate: itemReq.manufactureDate ? new Date(itemReq.manufactureDate) : oldItem?.ManufactureDate ?? null,
        ExpiryDate: itemReq.expiryDate ? new Date(itemReq.expiryDate) : oldItem?.ExpiryDate ?? null,
        Notes: itemReq.notes?.trim() || oldItem?.Notes || null,
      });
    }

    await tx.goodsReceiptItems.deleteMany({ where: { GrnId: id } });

    const updatedGrn = await tx.goodsReceipts.update({
      where: { GrnId: id },
      data: {
        Notes: body.notes !== undefined ? body.notes?.trim() : grn.Notes,
        GoodsReceiptItems: {
          create: grnItems
        }
      },
      include: {
        Deliveries: { include: { PurchaseOrders: { include: { Suppliers: true } } } },
        GoodsReceiptItems: {
          include: { Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }, UnitOfMeasures: true }
        }
      }
    });

    const response = {
      grnId: updatedGrn.GrnId,
      grnNumber: updatedGrn.GrnNumber,
      poId: updatedGrn.PoId,
      poNumber: updatedGrn.Deliveries?.PurchaseOrders?.PoNumber,
      deliveryId: updatedGrn.DeliveryId,
      deliveryNumber: updatedGrn.Deliveries?.DeliveryNumber,
      supplierId: updatedGrn.Deliveries?.PurchaseOrders?.SupplierId,
      supplierName: updatedGrn.Deliveries?.PurchaseOrders?.Suppliers?.CompanyName || "",
      status: updatedGrn.Status,
      receivedDate: updatedGrn.ReceivedDate,
      receivedBy: updatedGrn.ReceivedBy,
      notes: updatedGrn.Notes,
      createdAt: updatedGrn.CreatedAt,
      items: updatedGrn.GoodsReceiptItems.map(i => ({
        grnItemId: i.GrnItemId,
        itemId: i.ItemId,
        itemName: i.Items?.ItemName || "",
        poItemId: i.PoItemId,
        orderedQuantity: Number(i.OrderedQuantity),
        previouslyReceivedQuantity: Number(i.PreviouslyReceivedQuantity),
        declaredQuantity: i.DeclaredQuantity == null ? null : Number(i.DeclaredQuantity),
        deliveredQuantity: Number(i.DeliveredQuantity),
        varianceQuantity: Number(i.VarianceQuantity),
        varianceType: i.VarianceType,
        deliveryItemId: i.DeliveryItemId,
        purchaseUomId: i.PurchaseUomId,
        purchaseUomName: i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
        supplierLotCode: i.SupplierLotCode || undefined,
        manufactureDate: i.ManufactureDate ? i.ManufactureDate.toISOString() : undefined,
        expiryDate: i.ExpiryDate ? i.ExpiryDate.toISOString() : undefined,
        notes: i.Notes || undefined
      }))
    };

    return { result: resourceResult({ success: true, message: "Draft GRN updated successfully.", data: response }), audit: { module: MODULE, change: "updated", target: { type: "goods-receipt", id: updatedGrn.GrnId, name: updatedGrn.GrnNumber }, description: `${staff.name} updated goods receipt ${updatedGrn.GrnNumber}` } };

  });
}

export async function postReceipt(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);

    const grn = await tx.goodsReceipts.findUnique({
      where: { GrnId: id },
      include: {
        GoodsReceiptItems: true
      }
    });

    if (!grn) {
      return refuse(`Goods Receipt Note ${id} not found.`);
    }

    if (grn.Status !== "Draft") {
      return refuse(`Only GRNs in Draft status can be posted for QA. Current status: ${grn.Status}.`);
    }

    const updatedGrn = await (async () => {
      // 1. Advance GRN status to QaPending
      const result = await tx.goodsReceipts.update({
        where: { GrnId: id },
        data: { Status: "QaPending", PostedBy: staff.username, PostedAt: new Date() }
      });

      // 2. Automatically generate or refresh QA Inspection keyed by GRN number (no separate QC number)
      const existingInspection = await tx.qualityInspections.findFirst({
        where: { ReferenceType: "GRN", ReferenceId: grn.GrnId },
      });

      if (existingInspection) {
        await tx.qualityInspectionItems.deleteMany({
          where: { InspectionId: existingInspection.InspectionId },
        });
        await tx.qualityInspections.update({
          where: { InspectionId: existingInspection.InspectionId },
          data: {
            Status: "Pending",
            InspectorId: staff.username,
            InspectorName: staff.name,
            InspectionDate: new Date(),
            QualityInspectionItems: {
              create: grn.GoodsReceiptItems.map((item) => ({
                ItemId: item.ItemId,
                DeliveredQuantity: item.DeliveredQuantity,
                AcceptedQuantity: 0,
                RejectedQuantity: 0,
                ConcessionQuantity: 0,
              }))
            }
          }
        });
      } else {
        let inspectionNumber = grn.GrnNumber;
        const collision = await tx.qualityInspections.findUnique({
          where: { InspectionNumber: inspectionNumber },
        });
        if (collision) {
          inspectionNumber = `${grn.GrnNumber}-${grn.GrnId}`;
        }

        await tx.qualityInspections.create({
          data: {
            InspectionNumber: inspectionNumber,
            InspectionType: "Receiving",
            ReferenceType: "GRN",
            ReferenceId: grn.GrnId,
            ReferenceNumber: grn.GrnNumber,
            InspectorId: staff.username,
            InspectorName: staff.name,
            InspectionDate: new Date(),
            Status: "Pending",
            QualityInspectionItems: {
              create: grn.GoodsReceiptItems.map((item) => ({
                ItemId: item.ItemId,
                DeliveredQuantity: item.DeliveredQuantity,
                AcceptedQuantity: 0,
                RejectedQuantity: 0,
                ConcessionQuantity: 0,
              }))
            }
          }
        });
      }

      return result;
    })();

    return { result: resourceResult({ success: true, message: "GRN posted for QA inspection.", data: updatedGrn }), audit: { module: MODULE, change: "updated", target: { type: "goods-receipt", id: updatedGrn.GrnId, name: updatedGrn.GrnNumber }, description: `${staff.name} posted goods receipt for QA ${updatedGrn.GrnNumber}` } };

  });
}

export async function cancelReceipt(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);

    const grn = await tx.goodsReceipts.findUnique({
      where: { GrnId: id },
      include: { Deliveries: true }
    });

    if (!grn) {
      return refuse(`Goods Receipt Note ${id} not found.`);
    }

    if (grn.Status !== "Draft") {
      return refuse(`Only Draft GRNs can be cancelled. Current status: ${grn.Status}.`);
    }

    const updatedGrn = await tx.goodsReceipts.update({
      where: { GrnId: id },
      data: { Status: "Cancelled" }
    });

    if (grn.Deliveries && grn.DeliveryId !== null) {
      await tx.deliveries.update({
        where: { DeliveryId: grn.DeliveryId },
        data: { Status: "Arrived" } // Revert delivery status back to arrived so it can be re-received
      });
    }

    return { result: resourceResult({ success: true, message: "GRN cancelled successfully.", data: updatedGrn }), audit: { module: MODULE, change: "updated", target: { type: "goods-receipt", id: updatedGrn.GrnId, name: updatedGrn.GrnNumber }, description: `${staff.name} cancelled goods receipt ${updatedGrn.GrnNumber}` } };

  });
}

export async function rejectReceipt(idInput: string | number, body: ReceiptInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const grn = await tx.goodsReceipts.findUnique({
      where: { GrnId: id },
      include: {
        Deliveries: {
          include: {
            DeliveryItems: true,
            PurchaseOrders: { include: { PurchaseOrderItems: true } },
          },
        },
        PurchaseOrders: true,
        GoodsReceiptItems: true,
      },
    });

    if (!grn) {
      return refuse(`Goods Receipt Note ${id} not found.`);
    }

    if (grn.Status === "Completed" || grn.Status === "Cancelled") {
      return refuse(`Cannot reject a GRN in ${grn.Status} status.`);
    }

    const reason = body.reason?.trim() || "Rejected by user.";
    const now = new Date();

    const updatedGrn = await tx.goodsReceipts.update({
      where: { GrnId: id },
      data: {
        Status: "Rejected",
        RejectedBy: staff.username,
        RejectedAt: now,
        RejectionReason: reason,
        Notes: grn.Notes ? `${grn.Notes}\nRejected: ${reason}` : `Rejected: ${reason}`
      }
    });

    if (grn.Deliveries && grn.DeliveryId !== null) {
      await tx.deliveries.update({
        where: { DeliveryId: grn.DeliveryId },
        data: { Status: "Rejected" }
      });
    }

    // Automatically log Discrepancy records for every line item on this rejected shipment
    const existingDiscrepancies = await tx.discrepancies.count({
      where: { GrnId: grn.GrnId },
    });

    if (existingDiscrepancies === 0) {
      const year = now.getFullYear();
      const poNumber = grn.Deliveries?.PurchaseOrders?.PoNumber || grn.PurchaseOrders?.PoNumber || "";
      const deliveryNumber = grn.Deliveries?.DeliveryNumber || null;

      // Aggregate by ItemId in case multiple batches were recorded for the same item
      const itemMap = new Map<number, { orderedQty: number; declaredQty: number }>();
      if (grn.GoodsReceiptItems?.length > 0) {
        for (const line of grn.GoodsReceiptItems) {
          const prev = itemMap.get(line.ItemId);
          const declared = line.DeclaredQuantity != null ? Number(line.DeclaredQuantity) : Number(line.OrderedQuantity);
          if (!prev) {
            itemMap.set(line.ItemId, {
              orderedQty: Number(line.OrderedQuantity),
              declaredQty: declared,
            });
          }
        }
      } else if (grn.Deliveries?.DeliveryItems?.length) {
        for (const delItem of grn.Deliveries.DeliveryItems) {
          const poItem = grn.Deliveries.PurchaseOrders?.PurchaseOrderItems?.find(p => p.PoItemId === delItem.PoItemId);
          itemMap.set(delItem.ItemId, {
            orderedQty: Number(poItem?.PoItemQuantity ?? delItem.DeclaredQuantity),
            declaredQty: Number(delItem.DeclaredQuantity),
          });
        }
      }

      for (const [itemId, qtys] of itemMap.entries()) {
        const dscSeq = await tx.documentSequences.upsert({
          where: { DocType_Year: { DocType: "Discrepancy", Year: year } },
          update: { LastNumber: { increment: 1 } },
          create: { DocType: "Discrepancy", Year: year, LastNumber: 1 },
        });
        const dscNumber = `DSC-${year}-${String(dscSeq.LastNumber).padStart(4, "0")}`;

        await tx.discrepancies.create({
          data: {
            DiscrepancyNumber: dscNumber,
            DiscrepancyType: "Rejected",
            GrnId: grn.GrnId,
            GrnNumber: grn.GrnNumber,
            PoId: grn.PoId,
            PoNumber: poNumber,
            DeliveryId: grn.DeliveryId,
            DeliveryNumber: deliveryNumber,
            ItemId: itemId,
            OrderedQuantity: qtys.orderedQty,
            PreviouslyReceivedQty: 0,
            CurrentReceivedQty: 0,
            DiscrepancyQuantity: Math.max(1, qtys.declaredQty || qtys.orderedQty),
            Status: "Open",
            ResolutionNotes: `Entire shipment rejected: ${reason}`,
            CreatedAt: now,
          },
        });
      }
    }

    return { result: resourceResult({ success: true, message: "GRN rejected and discrepancy records logged.", data: updatedGrn }), audit: { module: MODULE, change: "rejected", target: { type: "goods-receipt", id: updatedGrn.GrnId, name: updatedGrn.GrnNumber }, description: `${staff.name} rejected goods receipt ${updatedGrn.GrnNumber}` }, after: () => notifyRequester(grn.CreatedBy, "rejected", updatedGrn.GrnNumber) };

  });
}

export async function proceedToQa(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);

    const grn = await tx.goodsReceipts.findUnique({
      where: { GrnId: id },
    });

    if (!grn) {
      return refuse(`Goods Receipt Note ${id} not found.`);
    }

    if (grn.Status !== "Draft") {
      return refuse(`Only Draft GRNs can proceed to QA. Current status: ${grn.Status}.`);
    }

    const updatedGrn = await tx.goodsReceipts.update({
      where: { GrnId: id },
      data: { Status: "QaPending" }
    });

    return { result: resourceResult({ success: true, message: "GRN moved to QA Pending.", data: updatedGrn }), audit: { module: MODULE, change: "updated", target: { type: "goods-receipt", id: updatedGrn.GrnId, name: updatedGrn.GrnNumber }, description: `${staff.name} moved goods receipt to QA ${updatedGrn.GrnNumber}` } };

  });
}
