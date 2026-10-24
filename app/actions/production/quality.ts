"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { notifyBatchRequester } from "@/lib/production/notify";
import { mutate, read, refuse, validateInput } from "@/lib/production/mutate";
export async function listProductionQa(query = "") {
    await requireModule("Production & Quality");
    return read(async () => {
        const searchParams = new URLSearchParams(query);
        const status = searchParams.get("status") || "pending"; // "pending" | "completed" | "all"
        // Batches in "For QA", "For Stock-in", or "Stocked In"
        const where: any = {};
        if (status === "pending") {
            where.Status = "For QA";
        }
        else if (status === "completed") {
            where.Status = { in: ["For Stock-in", "Stocked In", "Completed"] };
        }
        else {
            where.Status = { in: ["For QA", "For Stock-in", "Stocked In", "Completed"] };
        }
        const batches = await prisma.productionBatches.findMany({
            where,
            include: {
                FinishedProducts: {
                    include: { Items: true },
                },
                InventoryLots: true,
                ProductionRequests: true,
                BatchConsumptions: {
                    include: {
                        Items: true,
                        UnitOfMeasures: true,
                        InventoryLots: true,
                    },
                },
            },
            orderBy: { BatchId: "desc" },
        });
        const mapped = batches.map((b) => ({
            batchId: b.BatchId,
            batchNumber: b.BatchNumber,
            prodReqId: b.ProdReqId,
            reqNumber: b.ProductionRequests?.ReqNumber ?? "",
            requestedBy: b.ProductionRequests?.RequestedBy ?? "",
            approvedBy: b.ProductionRequests?.ApprovedBy ?? "",
            productId: b.ProductId,
            productName: b.FinishedProducts?.Items?.ItemName ?? "",
            productCode: b.FinishedProducts?.Items?.ItemCode ?? "",
            variant: b.FinishedProducts?.Variant ?? "",
            fgLotId: b.FgLotId,
            fgLotCode: b.InventoryLots?.LotCode ?? "",
            mfgDate: b.PackagedAt ? b.PackagedAt.toISOString() : b.ProductionDate.toISOString(),
            expiryDate: b.ExpiryDate ? b.ExpiryDate.toISOString() : null,
            requestQty: Number(b.ProductionRequests?.Quantity ?? b.EstimatedQuantity),
            packedQty: Number(b.FinalQuantity ?? b.ActualQuantity),
            yieldPercentage: Number(b.YieldPercentage),
            status: b.Status,
            qualityStatus: b.QualityStatus,
            imageUrl: b.ImageUrl ?? "",
            packagedBy: b.PackagedBy ?? "",
            materials: (b.BatchConsumptions ?? []).map((c) => ({
                itemName: c.Items?.ItemName ?? "",
                quantity: Number(c.QuantityUsed),
                uom: c.UnitOfMeasures?.Abbreviation ?? "",
            })),
        }));
        return resourceResult({ success: true, data: mapped });
    });
}
export async function reviewProductionQa(body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        validateInput(body);
        const batchId = parseInt(body.batchId, 10);
        const acceptedQuantity = Number(body.acceptedQuantity ?? 0);
        const acceptedReason = String(body.acceptedReason || "").trim();
        const rejectedQuantity = Number(body.rejectedQuantity ?? 0);
        const rejectedReason = String(body.rejectedReason || "").trim();
        const inspectorName = staff.name;
        const remarks = String(body.remarks || "").trim();
        const checklist = body.checklist || {};
        if (isNaN(batchId)) {
            return refuse("Valid batchId is required.");
        }
        const batch = await tx.productionBatches.findUnique({
            where: { BatchId: batchId },
            include: {
                FinishedProducts: {
                    include: { Items: true },
                },
                InventoryLots: true,
                ProductionRequests: true,
            },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (batch.Status !== "For QA") {
            return refuse(`Batch status is '${batch.Status}', cannot perform QA.`);
        }
        const totalPacked = Number(batch.FinalQuantity || batch.ActualQuantity);
        if (acceptedQuantity + rejectedQuantity !== totalPacked) {
            return refuse(`Accepted quantity (${acceptedQuantity}) + Rejected quantity (${rejectedQuantity}) must equal total packed quantity (${totalPacked}).`);
        }
        if (acceptedQuantity > 0 && !acceptedReason) {
            return refuse("Reason for accepted units is required.");
        }
        if (rejectedQuantity > 0 && !rejectedReason) {
            return refuse("Reason for rejected units is required.");
        }
        const now = new Date();
        const year = now.getFullYear();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        // 1. Generate unique Production QA sequence: PQA-YYMMDD-XXX
        const docType = "PQA_Inspection";
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: docType, Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: docType, Year: year, LastNumber: 1 },
        });
        const pqaNumber = `PQA-${dateStr.slice(2)}-${String(seq.LastNumber).padStart(3, "0")}`;
        const qaStatus = rejectedQuantity === 0 ? "Passed" : acceptedQuantity === 0 ? "Rejected" : "Partial Pass";
        const nextBatchStatus = acceptedQuantity > 0 ? "For Stock-in" : "Rejected";
        const result = await (async () => {
            // 2. If rejected units exist, automatically create Loss Report
            let lossReportNumber: string | null = null;
            if (rejectedQuantity > 0) {
                const lossSeq = await tx.documentSequences.upsert({
                    where: { DocType_Year: { DocType: "LossReport_QA", Year: year } },
                    update: { LastNumber: { increment: 1 } },
                    create: { DocType: "LossReport_QA", Year: year, LastNumber: 1 },
                });
                lossReportNumber = `LR-QA-${dateStr}-${String(lossSeq.LastNumber).padStart(4, "0")}`;
                await tx.lossReports.create({
                    data: {
                        LossReportNumber: lossReportNumber,
                        ItemId: batch.FinishedProducts?.ItemId || batch.ProductId,
                        UomId: batch.FinishedProducts?.Items?.UomId || 1,
                        LostQuantity: rejectedQuantity,
                        Reason: `QA Inspection Rejected: ${rejectedReason}`,
                        Notes: `PQA: ${pqaNumber}. Batch: ${batch.BatchNumber}. Lot: ${batch.InventoryLots?.LotCode || "N/A"}. Inspector: ${inspectorName}`,
                        AuthorisedBy: staff.username,
                        CreatedBy: staff.username,
                        CreatedAt: now,
                        IsAcknowledged: false,
                    },
                });
            }
            // 3. Create QualityInspections record
            const inspection = await tx.qualityInspections.create({
                data: {
                    InspectionNumber: pqaNumber,
                    InspectionType: "Production",
                    ReferenceType: "ProductionBatch",
                    ReferenceId: batch.BatchId,
                    ReferenceNumber: batch.BatchNumber,
                    InspectorId: staff.username,
                    InspectorName: inspectorName,
                    InspectionDate: now,
                    Status: qaStatus,
                    TotalReceivedQuantity: totalPacked,
                    TotalAcceptedQuantity: acceptedQuantity,
                    TotalRejectedQuantity: rejectedQuantity,
                    OverallNotes: JSON.stringify({
                        acceptedReason,
                        rejectedReason,
                        remarks,
                        checklist,
                        lossReportNumber,
                    }),
                    CompletedAt: now,
                    CompletedBy: staff.username,
                },
            });
            // 4. Update Production Batches
            const activityLog = `[ACTIVITY:${now.toISOString()}|TITLE:QA review completed (${qaStatus}): ${acceptedQuantity} accepted, ${rejectedQuantity} rejected|ACTOR:${staff.username}]`;
            const updatedNotes = batch.Notes ? `${batch.Notes}\n${activityLog}` : activityLog;
            const updatedBatch = await tx.productionBatches.update({
                where: { BatchId: batch.BatchId },
                data: {
                    QualityStatus: qaStatus,
                    Status: nextBatchStatus,
                    CurrentStage: nextBatchStatus,
                    Notes: updatedNotes,
                },
            });
            // 5. Update linked Production Request
            if (batch.ProdReqId) {
                await tx.productionRequests.update({
                    where: { ProdReqId: batch.ProdReqId },
                    data: {
                        Status: nextBatchStatus,
                        UpdatedAt: now,
                    },
                });
            }
            return { updatedBatch, inspection, lossReportNumber };
        })();
        return { result: resourceResult({
                success: true,
                message: `QA Review completed (${qaStatus}) under ${pqaNumber}!`,
                data: {
                    pqaNumber,
                    status: qaStatus,
                    nextStatus: nextBatchStatus,
                    lossReportNumber: result.lossReportNumber,
                },
            }), audit: { module: "Production & Quality", change: "created", target: { type: "quality-inspection", id: result.inspection.InspectionId, name: pqaNumber }, description: `${staff.name} completed quality inspection ${pqaNumber} (${qaStatus})` }, after: () => notifyBatchRequester(batch, acceptedQuantity > 0 ? "approved" : "rejected") };
    });
}
