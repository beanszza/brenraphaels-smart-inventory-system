"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { isFileId } from "@/lib/files";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
import { notifyBatchRequester } from "@/lib/production/notify";
export async function rejectBatch(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const reason = String(body.reason || "").trim();
        const proofImageUrl = String(body.proofImageUrl || "").trim();
        const rejectionDate = body.rejectionDate ? new Date(body.rejectionDate) : new Date();
        const notes = String(body.notes || "").trim();
        if (!reason) {
            return refuse("Rejection reason is required.");
        }
        const batch = await tx.productionBatches.findUnique({
            where: { BatchId: id },
            include: {
                FinishedProducts: {
                    include: { Items: true },
                },
                ProductionRequests: true,
                BatchConsumptions: {
                    include: { Items: true },
                },
            },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (proofImageUrl && (!isFileId(proofImageUrl) || proofImageUrl !== batch.ImageUrl))
            refuse("Upload and confirm a rejection photo for this batch first.");
        if (["Completed", "Stocked In", "Cancelled"].includes(batch.Status))
            refuse("Cannot reject a closed batch.");
        if (batch.Status === "Rejected") {
            return refuse("This batch has already been rejected.");
        }
        const now = new Date();
        const year = now.getFullYear();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        // Generate unique Loss Report sequence
        const docType = "LossReport_Production";
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: docType, Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: docType, Year: year, LastNumber: 1 },
        });
        const lossReportNumber = `LR-PRD-${dateStr}-${String(seq.LastNumber).padStart(4, "0")}`;
        // Item to log loss for (either finished product or primary ingredient)
        const itemId = batch.FinishedProducts?.ItemId || batch.ProductId;
        const uomId = batch.FinishedProducts?.Items?.UomId || 1;
        const lostQty = Number(batch.EstimatedQuantity) > 0 ? Number(batch.EstimatedQuantity) : 1;
        const fullReason = `Batch Rejected (${batch.BatchNumber}): ${reason}`;
        const fullNotes = `Cook: ${staff.username}. ${notes ? `Notes: ${notes}. ` : ""}PR: ${batch.ProductionRequests?.ReqNumber || "N/A"}. Date: ${rejectionDate.toISOString()}`;
        // Transaction to update batch, update PR, and create LossReport
        const result = await (async () => {
            // 1. Create Loss Report
            const lossReport = await tx.lossReports.create({
                data: {
                    LossReportNumber: lossReportNumber,
                    ItemId: itemId,
                    UomId: uomId,
                    LostQuantity: lostQty,
                    Reason: fullReason,
                    Notes: fullNotes,
                    AuthorisedBy: staff.username,
                    CreatedBy: staff.username,
                    CreatedAt: now,
                    IsAcknowledged: false,
                },
            });
            // 2. Update Production Batch
            const updatedBatch = await tx.productionBatches.update({
                where: { BatchId: id },
                data: {
                    Status: "Rejected",
                    RejectionReason: reason,
                    ImageUrl: proofImageUrl || batch.ImageUrl,
                    Notes: batch.Notes
                        ? `${batch.Notes}\n[REJECTED: ${reason} | Loss Report: ${lossReportNumber}]`
                        : `[REJECTED: ${reason} | Loss Report: ${lossReportNumber}]`,
                },
            });
            // 3. Update linked Production Request
            if (batch.ProdReqId) {
                await tx.productionRequests.update({
                    where: { ProdReqId: batch.ProdReqId },
                    data: {
                        Status: "Rejected",
                        RejectionReason: reason,
                        RejectedBy: staff.username,
                        RejectedAt: now,
                    },
                });
            }
            return { updatedBatch, lossReport };
        })();
        return { result: resourceResult({
                success: true,
                message: `Production batch rejected. Loss Report ${lossReportNumber} created in Loss & Disposal.`,
                data: {
                    batchId: result.updatedBatch.BatchId,
                    status: result.updatedBatch.Status,
                    lossReportNumber: result.lossReport.LossReportNumber,
                    lossReportId: result.lossReport.LossReportId,
                },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} rejected production batch (${String(id)})` }, after: () => notifyBatchRequester(batch, "rejected") };
    });
}
