import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get("poId");
    const deliveryId = searchParams.get("deliveryId");
    const status = searchParams.get("status") || "All";

    const where: any = {};
    if (poId) {
      where.PoId = parseInt(poId, 10);
    }
    if (deliveryId) {
      where.DeliveryId = parseInt(deliveryId, 10);
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
        supplierLotCode: i.SupplierLotCode || null,
        manufactureDate: i.ManufactureDate ? i.ManufactureDate.toISOString() : null,
        expiryDate: i.ExpiryDate ? i.ExpiryDate.toISOString() : null,
        notes: i.Notes || ""
      }))
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching GRNs:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const delivery = await prisma.deliveries.findUnique({
      where: { DeliveryId: body.deliveryId },
      include: { PurchaseOrders: { include: { PurchaseOrderItems: true } }, DeliveryItems: true }
    });

    if (!delivery) {
      return NextResponse.json({ success: false, message: `Delivery ${body.deliveryId} not found.` }, { status: 404 });
    }

    if (delivery.Status !== "Arrived") {
      return NextResponse.json({ success: false, message: `Only Arrived deliveries can have a Goods Receipt Note created. Current status: ${delivery.Status}.` }, { status: 400 });
    }

    // Check if GRN already exists for this delivery (not cancelled/rejected)
    const existing = await prisma.goodsReceipts.findFirst({
      where: { DeliveryId: body.deliveryId, Status: { notIn: ["Cancelled", "Rejected"] } }
    });
    if (existing) {
      return NextResponse.json({ success: false, message: `An active GRN already exists for this delivery.` }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ success: false, message: "GRN must contain at least one item." }, { status: 400 });
    }

    const year = new Date().getFullYear();

    // Find the latest existing GRN number for this year to prevent unique constraint collisions
    const latestGrns = await prisma.goodsReceipts.findMany({
      where: { GrnNumber: { startsWith: `GRN-${year}-` } },
      select: { GrnNumber: true },
    });

    let maxNum = 0;
    latestGrns.forEach((g) => {
      const match = g.GrnNumber.match(/GRN-\d{4}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const currentSeq = await prisma.documentSequences.findFirst({
      where: {
        DocType: { in: ["GoodsReceipt", "GoodsReceiptNote"] },
        Year: year,
      },
      orderBy: { LastNumber: "desc" },
    });

    const nextNumber = Math.max(maxNum, currentSeq?.LastNumber || 0) + 1;

    // Synchronize both sequence keys
    await Promise.all([
      prisma.documentSequences.upsert({
        where: { DocType_Year: { DocType: "GoodsReceipt", Year: year } },
        update: { LastNumber: nextNumber },
        create: { DocType: "GoodsReceipt", Year: year, LastNumber: nextNumber },
      }),
      prisma.documentSequences.upsert({
        where: { DocType_Year: { DocType: "GoodsReceiptNote", Year: year } },
        update: { LastNumber: nextNumber },
        create: { DocType: "GoodsReceiptNote", Year: year, LastNumber: nextNumber },
      }),
    ]);

    const grnNumber = `GRN-${year}-${String(nextNumber).padStart(4, '0')}`;

    const receivingLocation = await prisma.locations.findFirst({
      where: { IsSystemLocation: true, LocationType: "Warehouse", IsActive: true },
    });
    if (!receivingLocation) {
      return NextResponse.json({ success: false, message: "No active system warehouse is configured for receiving." }, { status: 500 });
    }

    const grnItems = [];
    for (const itemReq of body.items) {
      const delItem = delivery.DeliveryItems.find(i =>
        itemReq.deliveryItemId ? i.DeliveryItemId === itemReq.deliveryItemId : i.ItemId === itemReq.itemId
      );
      if (!delItem) {
        return NextResponse.json({ success: false, message: `Item ${itemReq.itemId} was not in the delivery shipment.` }, { status: 400 });
      }

      const poItem = delivery.PurchaseOrders.PurchaseOrderItems.find(i => i.PoItemId === delItem.PoItemId);
      if (!poItem || (itemReq.poItemId && itemReq.poItemId !== poItem.PoItemId)) {
        return NextResponse.json({ success: false, message: "Every GRN line must match its delivery and purchase-order line." }, { status: 400 });
      }

      const declared = Number(delItem.DeclaredQuantity);
      const delivered = Number(itemReq.deliveredQuantity ?? itemReq.actualReceivedQuantity ?? 0);
      
      if (delivered < 0) {
        return NextResponse.json({ success: false, message: `Actual received quantity cannot be negative.` }, { status: 400 });
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

    const newGrn = await prisma.goodsReceipts.create({
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
        ReceivedBy: body.receivedBy || "System User",
        CreatedBy: body.receivedBy || "System User",
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
        supplierLotCode: i.SupplierLotCode || null,
        manufactureDate: i.ManufactureDate ? i.ManufactureDate.toISOString() : null,
        expiryDate: i.ExpiryDate ? i.ExpiryDate.toISOString() : null,
        notes: i.Notes || ""
      }))
    };

    return NextResponse.json({ success: true, message: "Draft GRN created successfully.", data: response });
  } catch (error: any) {
    console.error("Error creating GRN:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}
