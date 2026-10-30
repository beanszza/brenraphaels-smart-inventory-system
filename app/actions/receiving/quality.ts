"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/receiving/mutate";
import type { InspectionInput } from "@/lib/receiving/inputs";

const MODULE = "Goods Receiving";

export async function listInspections(query = "") {
  await requireModule(MODULE);
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const grnId = searchParams.get("grnId");

    let whereClause = { ReferenceType: "GRN" } as import("@prisma/client").Prisma.QualityInspectionsWhereInput;
    if (grnId) {
      whereClause = {
        ReferenceType: "GRN",
        ReferenceId: positiveId(grnId)
      };
    }

    const inspections = await prisma.qualityInspections.findMany({
      where: whereClause,
      include: {
        QualityInspectionItems: {
          include: {
            Items: {
              include: {
                UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true,
                Uom: true,
              }
            },
            InventoryLots: true
          }
        }
      }
    });

    const responseData = inspections.map((q: typeof inspections[number]) => ({
      inspectionId: q.InspectionId,
      inspectionNumber: q.ReferenceNumber || q.InspectionNumber,
      inspectionType: q.InspectionType,
      referenceType: q.ReferenceType,
      referenceId: q.ReferenceId,
      referenceNumber: q.ReferenceNumber,
      grnNumber: q.ReferenceNumber,
      inspectorId: q.InspectorId,
      inspectorName: q.InspectorName,
      inspectionDate: q.InspectionDate,
      status: q.Status,
      overallNotes: q.OverallNotes,
      completedAt: q.CompletedAt,
      items: q.QualityInspectionItems.map((qi: typeof q.QualityInspectionItems[number]) => ({
        inspectionItemId: qi.InspectionItemId,
        itemId: qi.ItemId,
        itemName: qi.Items?.ItemName,
        categoryName: "",
        lotId: qi.LotId,
        deliveredQuantity: Number(qi.DeliveredQuantity),
        acceptedQuantity: Number(qi.AcceptedQuantity),
        rejectedQuantity: Number(qi.RejectedQuantity),
        concessionQuantity: Number(qi.ConcessionQuantity),
        defectReason: qi.DefectReason || "",
        notes: qi.Notes || "",
        lot: qi.InventoryLots ? {
          lotId: qi.InventoryLots.LotId,
          lotCode: qi.InventoryLots.LotCode,
          expiryDate: qi.InventoryLots.ExpiryDate
        } : null
      }))
    }));

    return resourceResult({ success: true, data: responseData });

  });
}

export async function completeInspection(idInput: string | number, body: InspectionInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const existingInspection = await tx.qualityInspections.findUnique({
      where: { InspectionId: id },
      include: { QualityInspectionItems: true },
    });

    if (!existingInspection || existingInspection.ReferenceType !== "GRN") {
      return refuse("QA inspection not found.");
    }

    if (existingInspection.Status === "Completed") refuse("QA inspection is already completed.");
    if (!body.items?.length) refuse("Include the inspection item results.");
    if (new Set(body.items.map(item => item.inspectionItemId)).size !== body.items.length) refuse("Each inspection line may appear only once.");
    for (const item of body.items) {
      const source = existingInspection.QualityInspectionItems.find(line => line.InspectionItemId === item.inspectionItemId);
      if (!source) refuse("An item does not belong to this inspection.");
      const total = (item.acceptedQuantity ?? 0) + (item.rejectedQuantity ?? 0) + (item.concessionQuantity ?? 0);
      if (total > Number(source.DeliveredQuantity)) refuse("Inspection quantities exceed the delivered quantity.");
    }

    const now = new Date();
    const totalReceived = body.items.reduce((sum, i) => {
      const src = existingInspection.QualityInspectionItems.find(l => l.InspectionItemId === i.inspectionItemId);
      return sum + Number(src?.DeliveredQuantity ?? 0);
    }, 0);
    const totalAccepted = body.items.reduce((sum, i) => sum + Number(i.acceptedQuantity ?? 0), 0);
    const totalRejected = body.items.reduce((sum, i) => sum + Number(i.rejectedQuantity ?? 0), 0);

    const updatedInspection = await (async () => {
      // 1. Update main inspection record
      const inspection = await tx.qualityInspections.update({
        where: { InspectionId: id },
        data: {
          Status: "Completed",
          CompletedAt: now,
          CompletedBy: staff.username,
          InspectorId: staff.username,
          InspectorName: staff.name,
          OverallNotes: body.overallNotes || existingInspection.OverallNotes,
          TotalReceivedQuantity: totalReceived,
          TotalAcceptedQuantity: totalAccepted,
          TotalRejectedQuantity: totalRejected,
        },
      });

      // 2. Update each item
      if (Array.isArray(body.items)) {
        for (const item of body.items) {
          if (item.inspectionItemId) {
            await tx.qualityInspectionItems.update({
              where: { InspectionItemId: item.inspectionItemId },
              data: {
                AcceptedQuantity: item.acceptedQuantity ?? 0,
                RejectedQuantity: item.rejectedQuantity ?? 0,
                ConcessionQuantity: item.concessionQuantity ?? 0,
                DefectReason: item.defectReason || null,
                Notes: item.notes || null,
              },
            });
          }
        }
      }

      // 3. Advance GRN status to QaCompleted (or Rejected if all units were rejected) and log Discrepancies
      const grn = await tx.goodsReceipts.findUnique({
        where: { GrnId: existingInspection.ReferenceId },
        include: {
          GoodsReceiptItems: true,
          Deliveries: { include: { PurchaseOrders: true } },
          PurchaseOrders: true,
        },
      });

      if (grn) {
        const nextGrnStatus = totalAccepted === 0 && totalRejected > 0 ? "Rejected" : "QaCompleted";
        await tx.goodsReceipts.update({
          where: { GrnId: grn.GrnId },
          data: { Status: nextGrnStatus },
        });

        // Update matching GRN line items so DeliveredQuantity reflects QA-accepted quantity for Stock-In
        if (grn.GoodsReceiptItems.length === existingInspection.QualityInspectionItems.length) {
          for (let idx = 0; idx < existingInspection.QualityInspectionItems.length; idx++) {
            const qi = existingInspection.QualityInspectionItems[idx];
            const inputLine = body.items?.find(b => b.inspectionItemId === qi.InspectionItemId);
            const grnLine = grn.GoodsReceiptItems[idx];
            if (inputLine && grnLine && grnLine.ItemId === qi.ItemId) {
              const accepted = Number(inputLine.acceptedQuantity ?? grnLine.DeliveredQuantity);
              await tx.goodsReceiptItems.update({
                where: { GrnItemId: grnLine.GrnItemId },
                data: {
                  DeliveredQuantity: accepted,
                  Notes: [grnLine.Notes, inputLine.notes].filter(Boolean).join(" | ") || null,
                },
              });
            }
          }
        }

        // Automatically create Open Discrepancies for any Shortages, Over-supplies, or QA Rejected quantities
        const year = now.getFullYear();
        const poNumber = grn.Deliveries?.PurchaseOrders?.PoNumber || grn.PurchaseOrders?.PoNumber || "";
        const deliveryNumber = grn.Deliveries?.DeliveryNumber || null;

        // 3a. Variance discrepancies (Short / Over) aggregated per ItemId across batches
        const byItem = new Map<number, { ordered: number; declared: number; received: number }>();
        for (const gLine of grn.GoodsReceiptItems) {
          const prev = byItem.get(gLine.ItemId) || {
            ordered: Number(gLine.OrderedQuantity),
            declared: gLine.DeclaredQuantity != null ? Number(gLine.DeclaredQuantity) : Number(gLine.OrderedQuantity),
            received: 0,
          };
          prev.received += Number(gLine.DeliveredQuantity);
          byItem.set(gLine.ItemId, prev);
        }

        for (const [itemId, totals] of byItem.entries()) {
          const diff = totals.received - totals.declared;
          if (diff !== 0) {
            const dscSeq = await tx.documentSequences.upsert({
              where: { DocType_Year: { DocType: "Discrepancy", Year: year } },
              update: { LastNumber: { increment: 1 } },
              create: { DocType: "Discrepancy", Year: year, LastNumber: 1 },
            });
            const dscNumber = `DSC-${year}-${String(dscSeq.LastNumber).padStart(4, "0")}`;
            await tx.discrepancies.create({
              data: {
                DiscrepancyNumber: dscNumber,
                DiscrepancyType: diff < 0 ? "PartialShort" : "OverSupply",
                GrnId: grn.GrnId,
                GrnNumber: grn.GrnNumber,
                PoId: grn.PoId,
                PoNumber: poNumber,
                DeliveryId: grn.DeliveryId,
                DeliveryNumber: deliveryNumber,
                ItemId: itemId,
                OrderedQuantity: totals.ordered,
                PreviouslyReceivedQty: 0,
                CurrentReceivedQty: totals.received,
                DiscrepancyQuantity: Math.abs(diff),
                Status: "Open",
                ResolutionNotes: diff < 0
                  ? `Receiving count shortage (${totals.received} received vs ${totals.declared} declared)`
                  : `Receiving over-supply (${totals.received} received vs ${totals.declared} declared)`,
                CreatedAt: now,
              },
            });
          }
        }

        // 3b. QA Rejection discrepancies for any rejected units
        for (const item of body.items) {
          const rejQty = Number(item.rejectedQuantity ?? 0);
          if (rejQty > 0) {
            const source = existingInspection.QualityInspectionItems.find(l => l.InspectionItemId === item.inspectionItemId);
            if (!source) continue;
            const itemTotals = byItem.get(source.ItemId);
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
                ItemId: source.ItemId,
                OrderedQuantity: itemTotals?.ordered ?? Number(source.DeliveredQuantity),
                PreviouslyReceivedQty: 0,
                CurrentReceivedQty: Number(item.acceptedQuantity ?? 0),
                DiscrepancyQuantity: rejQty,
                Status: "Open",
                ResolutionNotes: item.defectReason ? `QA Rejected: ${item.defectReason}` : "Rejected during receiving QA",
                CreatedAt: now,
              },
            });
          }
        }
      }

      return inspection;
    })();

    const refGrnNumber = existingInspection.ReferenceNumber || updatedInspection.InspectionNumber;
    return { result: resourceResult({ success: true, data: updatedInspection, message: `Quality Assurance completed for ${refGrnNumber}.` }), audit: { module: MODULE, change: "updated", target: { type: "goods-receipt", id: existingInspection.ReferenceId, name: refGrnNumber }, description: `${staff.name} completed quality inspection for ${refGrnNumber}` } };

  });
}
