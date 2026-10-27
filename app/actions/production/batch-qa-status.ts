"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { notifyBatchRequester } from "@/lib/production/notify";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function updateQaStatus(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id } });
        if (!batch) {
            return refuse("Batch not found.");
        }
        const isApproved = body.isApproved === true;
        const newStatus = isApproved ? "Passed QA" : "Failed QA";
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: {
                QualityStatus: isApproved ? "Passed" : "Failed",
                Status: newStatus,
                ...(body.rejectionReason && { RejectionReason: body.rejectionReason }),
            },
        });
        return { result: resourceResult({
                success: true,
                message: `QA status updated: ${newStatus}.`,
                data: { batchId: updated.BatchId, qualityStatus: updated.QualityStatus, status: updated.Status },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id, name: batch.BatchNumber }, description: `${staff.name} set batch ${batch.BatchNumber} QA status to ${newStatus}` }, after: () => notifyBatchRequester(batch, isApproved ? "approved" : "rejected") };
    });
}
