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
      inspectionNumber: q.InspectionNumber,
      inspectionType: q.InspectionType,
      referenceType: q.ReferenceType,
      referenceId: q.ReferenceId,
      referenceNumber: q.ReferenceNumber,
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
        categoryName: "", // Optional mapping
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

    const updatedInspection = await (async () => {
      // 1. Update main inspection record
      const inspection = await tx.qualityInspections.update({
        where: { InspectionId: id },
        data: {
          Status: "Completed",
          CompletedAt: new Date(),
          CompletedBy: staff.username,
          InspectorId: staff.username,
          InspectorName: staff.name,
          OverallNotes: body.overallNotes || existingInspection.OverallNotes,
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

      return inspection;
    })();

    return { result: resourceResult({ success: true, data: updatedInspection, message: "QA inspection completed successfully." }), audit: { module: MODULE, change: "updated", target: { type: "quality-inspection", id: updatedInspection.InspectionId, name: updatedInspection.InspectionNumber }, description: `${staff.name} completed quality inspection ${updatedInspection.InspectionNumber}` } };

  });
}
