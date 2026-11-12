"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/production/mutate";
import { formatBatchNumber } from "@/lib/production/production-batches";
import { resolveStaffName } from "@/lib/orders/dto";
const BATCH_INCLUDE = {
    FinishedProducts: {
        include: { Items: true },
    },
    Recipes: {
        include: { UnitOfMeasures: true },
    },
    ProductionRequests: {
        include: {
            ProductionReqLotReservations: {
                include: {
                    InventoryLots: true,
                    Items: true,
                },
            },
        },
    },
    InventoryLots: true,
    BatchConsumptions: {
        include: {
            Items: true,
            UnitOfMeasures: true,
            InventoryLots: true,
        },
    },
};
function mapBatch(b: any) {
    const product = b.FinishedProducts;
    const recipe = b.Recipes;
    const prodReq = b.ProductionRequests;
    return {
        batchId: b.BatchId,
        batchNumber: formatBatchNumber(b.BatchNumber, product?.Items?.ItemName),
        prodReqId: b.ProdReqId,
        reqNumber: prodReq?.ReqNumber ?? "",
        requestedBy: prodReq?.RequestedBy ?? "",
        approvedBy: prodReq?.ApprovedBy ?? "",
        requestedQty: Number(prodReq?.Quantity ?? b.EstimatedQuantity),
        productId: b.ProductId,
        productName: product?.Items?.ItemName ?? "",
        productCode: product?.Items?.ItemCode ?? "",
        variant: product?.Variant ?? "",
        sku: product?.Sku ?? "",
        recipeId: b.RecipeId,
        recipeName: recipe?.RecipeName ?? "",
        yieldUom: recipe?.UnitOfMeasures?.Abbreviation ?? "units",
        batchMultiplier: Number(b.BatchMultiplier),
        estimatedQuantity: Number(b.EstimatedQuantity),
        actualQuantity: Number(b.ActualQuantity),
        finalQuantity: Number(b.FinalQuantity ?? 0),
        scrapQuantity: Number(b.ScrapQuantity),
        scrapReason: b.ScrapReason ?? "",
        productionDate: b.ProductionDate?.toISOString() ?? null,
        startedAt: b.StartedAt?.toISOString() ?? null,
        completedDate: b.CompletedDate?.toISOString() ?? null,
        packagedAt: b.PackagedAt?.toISOString() ?? null,
        packagedBy: b.PackagedBy ?? "",
        expiryDate: b.ExpiryDate?.toISOString() ?? null,
        stage: b.CurrentStage || b.Stage,
        currentStage: b.CurrentStage || b.Stage,
        qualityStatus: b.QualityStatus,
        rejectionReason: b.RejectionReason ?? "",
        imageUrl: b.ImageUrl ?? "",
        notes: b.Notes ?? "",
        purpose: b.Purpose,
        status: b.Status,
        assignedCook: b.AssignedCook,
        fgLotId: b.FgLotId ?? null,
        fgLotCode: b.InventoryLots?.LotCode ?? "",
        totalMaterialCost: Number(b.TotalMaterialCost),
        unitCost: Number(b.UnitCost),
        yieldPercentage: Number(b.YieldPercentage),
        consumptions: (b.BatchConsumptions ?? []).map((c: any) => ({
            consumptionId: c.BatchConsumptionId,
            itemId: c.ItemId,
            itemName: c.Items?.ItemName ?? "",
            requiredQuantity: Number(c.RequiredQuantity),
            quantityUsed: Number(c.QuantityUsed),
            uomId: c.UomId,
            uomAbbr: c.UnitOfMeasures?.Abbreviation ?? "",
            lotId: c.LotId ?? null,
            lotCode: c.InventoryLots?.LotCode ?? "",
            unitCost: Number(c.UnitCost),
        })),
        reservations: (prodReq?.ProductionReqLotReservations ?? []).map((res: any) => ({
            reservationId: res.ReservationId,
            ingredientId: res.IngredientId,
            itemId: res.ItemId,
            itemName: res.Items?.ItemName ?? "",
            lotId: res.LotId,
            lotCode: res.InventoryLots?.LotCode ?? "",
            reservedQuantity: Number(res.ReservedQuantity),
        })),
    };
}
export async function getBatch(idInput: string | number) {
    await requireModule("Production & Quality");
    return read(async () => {
        const id = positiveId(idInput);
        const batch = await prisma.productionBatches.findUnique({
            where: { BatchId: id },
            include: BATCH_INCLUDE,
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        return resourceResult({ success: true, data: mapBatch(batch) });
    });
}
export async function updateBatch(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: {
                ...(body.notes !== undefined && { Notes: body.notes }),
                ...(body.purpose !== undefined && { Purpose: body.purpose }),
                ...(body.scheduleDate !== undefined && { ProductionDate: new Date(body.scheduleDate) }),
            },
            include: BATCH_INCLUDE,
        });
        return { result: resourceResult({ success: true, data: mapBatch(updated) }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} updated production batch (${String(id)})` } };
    });
}
export async function deleteBatch(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id } });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (!["Draft", "Pending Approval", "Rejected"].includes(batch.Status)) {
            return refuse("Only Draft, Pending Approval, or Rejected batches can be deleted.");
        }
        await tx.productionBatches.delete({ where: { BatchId: id } });
        return { result: resourceResult({ success: true, message: "Batch deleted." }), audit: { module: "Production & Quality", change: "deleted", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} deleted production batch (${String(id)})` } };
    });
}

export interface BatchLifecycleSummaryData {
    batchId: number;
    batchNumber: string;
    status: string;
    currentStage: string;
    productName: string;
    productCode: string;
    variant: string;
    sku: string;
    recipeName: string;
    yieldUom: string;
    request: {
        prodReqId: number | null;
        reqNumber: string;
        requestedBy: string;
        createdAt: string | null;
        approvedBy: string;
        approvedAt: string | null;
        requiredDate: string | null;
        requiredTime: string;
        priority: string;
        reason: string;
        targetQuantity: number;
        status: string;
    };
    issuance: {
        issuanceNumber: string;
        issuedBy: string;
        issuedAt: string | null;
        status: string;
        materials: Array<{
            itemName: string;
            lotCode: string;
            requiredQuantity: number;
            quantityUsed: number;
            uomAbbr: string;
            unitCost: number;
            verifiedByScan: boolean;
        }>;
    };
    production: {
        assignedCook: string;
        startedAt: string | null;
        completedDate: string | null;
        stages: Array<{
            stage: string;
            endTime: string;
            completedBy: string;
            notes: string;
        }>;
        activities: Array<{
            timestamp: string;
            title: string;
            actor: string;
        }>;
    };
    packaging: {
        packagedBy: string;
        packagedAt: string | null;
        finalQuantity: number;
        yieldPercentage: number;
        expiryDate: string | null;
        fgLotCode: string;
        fgLotStatus: string;
    };
    qa: {
        inspectionNumber: string;
        inspectorName: string;
        inspectionDate: string | null;
        status: string;
        totalReceivedQuantity: number;
        totalAcceptedQuantity: number;
        totalRejectedQuantity: number;
        acceptedReason: string;
        rejectedReason: string;
        remarks: string;
        lossReportNumber: string | null;
    } | null;
    stockIn: {
        postedAt: string | null;
        postedBy: string;
        locationName: string;
        quantity: number;
        fgLotCode: string;
    } | null;
}

export async function getBatchLifecycleSummary(idInput: string | number) {
    await requireModule("Production & Quality");
    return read(async () => {
        const id = positiveId(idInput);
        const batch = await prisma.productionBatches.findUnique({
            where: { BatchId: id },
            include: {
                FinishedProducts: { include: { Items: true } },
                Recipes: { include: { UnitOfMeasures: true } },
                InventoryLots: { include: { Locations: true } },
                ProductionRequests: {
                    include: {
                        MaterialIssuances: {
                            include: { MaterialIssuanceScans: true },
                            orderBy: { IssuanceId: "desc" },
                        },
                    },
                },
                BatchConsumptions: {
                    include: {
                        Items: true,
                        UnitOfMeasures: true,
                        InventoryLots: true,
                    },
                },
            },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }

        const [inspection, stockLedger, knownStaffRows] = await Promise.all([
            prisma.qualityInspections.findFirst({
                where: { ReferenceType: "ProductionBatch", ReferenceId: id },
                orderBy: { InspectionId: "desc" },
            }),
            prisma.stockLedgers.findFirst({
                where: {
                    ReferenceType: "ProductionBatch",
                    ReferenceId: { in: [batch.BatchNumber, String(id)] },
                    MovementType: { in: ["IN", "PRODUCTION_FG_STOCKIN"] },
                },
                include: { Locations: true },
                orderBy: { LedgerId: "desc" },
            }),
            typeof (prisma as any)?.knownStaff?.findMany === "function"
                ? prisma.knownStaff.findMany({ select: { StaffId: true, Username: true, Name: true } }).catch(() => [])
                : Promise.resolve([]),
        ]);

        const staffMap = new Map<string, string>();
        for (const s of knownStaffRows as Array<{ StaffId?: string; Username?: string; Name?: string }>) {
            if (s.Name) {
                if (s.Username) staffMap.set(s.Username.trim(), s.Name.trim());
                if (s.StaffId) staffMap.set(s.StaffId.trim(), s.Name.trim());
            }
        }
        const resolveActorName = (raw?: string | null, fallback = "—") => {
            if (!raw || !raw.trim()) return fallback;
            const trimmed = raw.trim();
            return staffMap.get(trimmed) || resolveStaffName(trimmed) || trimmed;
        };

        const lines = String(batch.Notes || "").split(/\r?\n/);
        const stages: BatchLifecycleSummaryData["production"]["stages"] = [];
        const activities: BatchLifecycleSummaryData["production"]["activities"] = [];
        for (const line of lines) {
            const stageMatch = line.match(/^\[STAGE:([^|\]]+)\|END:([^|\]]+)\|BY:([^|\]]+)(?:\|NOTES:([^\]]*))?\]$/);
            if (stageMatch) {
                stages.push({
                    stage: stageMatch[1].trim(),
                    endTime: stageMatch[2].trim(),
                    completedBy: resolveActorName(stageMatch[3].trim()),
                    notes: (stageMatch[4] || "").trim(),
                });
                continue;
            }
            const actMatch = line.match(/^\[ACTIVITY:([^|\]]+)\|TITLE:([^|\]]+)\|ACTOR:([^\]]+)\]$/);
            if (actMatch) {
                activities.push({
                    timestamp: actMatch[1].trim(),
                    title: actMatch[2].trim(),
                    actor: resolveActorName(actMatch[3].trim()),
                });
            }
        }

        const prodReq = batch.ProductionRequests;
        const latestIssuance = prodReq?.MaterialIssuances?.find((i) => i.Status === "Issued")
            ?? prodReq?.MaterialIssuances?.[0]
            ?? null;
        const verifiedLotIds = new Set(
            (latestIssuance?.MaterialIssuanceScans ?? [])
                .filter((s) => s.IsVerified)
                .map((s) => s.LotId)
        );

        let qaNotesParsed: any = {};
        if (inspection?.OverallNotes) {
            try {
                qaNotesParsed = JSON.parse(inspection.OverallNotes);
            }
            catch {
                qaNotesParsed = { remarks: inspection.OverallNotes };
            }
        }

        const yieldUom = batch.Recipes?.UnitOfMeasures?.Abbreviation ?? "units";
        const productName = batch.FinishedProducts?.Items?.ItemName ?? "";
        const data: BatchLifecycleSummaryData = {
            batchId: batch.BatchId,
            batchNumber: formatBatchNumber(batch.BatchNumber, productName),
            status: batch.Status,
            currentStage: batch.CurrentStage || batch.Stage,
            productName,
            productCode: batch.FinishedProducts?.Items?.ItemCode ?? "",
            variant: batch.FinishedProducts?.Variant ?? "Standard",
            sku: batch.FinishedProducts?.Sku ?? "",
            recipeName: batch.Recipes?.RecipeName ?? "",
            yieldUom,
            request: {
                prodReqId: prodReq?.ProdReqId ?? null,
                reqNumber: prodReq?.ReqNumber ?? "—",
                requestedBy: resolveActorName(prodReq?.RequestedBy),
                createdAt: prodReq?.CreatedAt?.toISOString() ?? null,
                approvedBy: resolveActorName(prodReq?.ApprovedBy),
                approvedAt: prodReq?.ApprovedAt?.toISOString() ?? null,
                requiredDate: prodReq?.RequiredDate?.toISOString() ?? null,
                requiredTime: prodReq?.RequiredTime ?? "",
                priority: prodReq?.Priority ?? "Medium",
                reason: prodReq?.Reason ?? "",
                targetQuantity: Number(prodReq?.Quantity ?? batch.EstimatedQuantity),
                status: prodReq?.Status ?? batch.Status,
            },
            issuance: {
                issuanceNumber: latestIssuance?.IssuanceNumber ?? "—",
                issuedBy: resolveActorName(latestIssuance?.IssuedBy),
                issuedAt: latestIssuance?.IssuedAt?.toISOString() ?? null,
                status: latestIssuance?.Status ?? "—",
                materials: (batch.BatchConsumptions ?? []).map((c) => ({
                    itemName: c.Items?.ItemName ?? "",
                    lotCode: c.InventoryLots?.LotCode ?? "—",
                    requiredQuantity: Number(c.RequiredQuantity),
                    quantityUsed: Number(c.QuantityUsed),
                    uomAbbr: c.UnitOfMeasures?.Abbreviation ?? "",
                    unitCost: Number(c.UnitCost),
                    verifiedByScan: c.LotId ? verifiedLotIds.has(c.LotId) : false,
                })),
            },
            production: {
                assignedCook: resolveActorName(batch.AssignedCook),
                startedAt: batch.StartedAt?.toISOString() ?? batch.ProductionDate?.toISOString() ?? null,
                completedDate: batch.CompletedDate?.toISOString() ?? null,
                stages,
                activities,
            },
            packaging: {
                packagedBy: resolveActorName(batch.PackagedBy),
                packagedAt: batch.PackagedAt?.toISOString() ?? null,
                finalQuantity: Number(batch.FinalQuantity ?? batch.ActualQuantity ?? 0),
                yieldPercentage: Number(batch.YieldPercentage ?? 0),
                expiryDate: batch.ExpiryDate?.toISOString() ?? null,
                fgLotCode: batch.InventoryLots?.LotCode ?? "—",
                fgLotStatus: batch.InventoryLots?.Status ?? "—",
            },
            qa: inspection
                ? {
                    inspectionNumber: inspection.InspectionNumber,
                    inspectorName: resolveActorName(inspection.InspectorName || inspection.InspectorId),
                    inspectionDate: inspection.InspectionDate?.toISOString() ?? null,
                    status: inspection.Status,
                    totalReceivedQuantity: Number(inspection.TotalReceivedQuantity),
                    totalAcceptedQuantity: Number(inspection.TotalAcceptedQuantity),
                    totalRejectedQuantity: Number(inspection.TotalRejectedQuantity),
                    acceptedReason: qaNotesParsed.acceptedReason || "",
                    rejectedReason: qaNotesParsed.rejectedReason || "",
                    remarks: qaNotesParsed.remarks || "",
                    lossReportNumber: qaNotesParsed.lossReportNumber || null,
                }
                : null,
            stockIn: stockLedger
                ? {
                    postedAt: stockLedger.PostedAt?.toISOString() ?? null,
                    postedBy: resolveActorName(stockLedger.UserName || stockLedger.UserId),
                    locationName: stockLedger.Locations?.LocationName ?? batch.InventoryLots?.Locations?.LocationName ?? "—",
                    quantity: Number(stockLedger.Quantity),
                    fgLotCode: batch.InventoryLots?.LotCode ?? "—",
                }
                : null,
        };

        return resourceResult({ success: true, data });
    });
}
