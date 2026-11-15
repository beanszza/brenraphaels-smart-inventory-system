"use server";
import { auditVersion } from "@/lib/audit";

import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId } from "@/lib/production/mutate";
import { notifyBatchRequester } from "@/lib/production/notify";
export async function approveBatch(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id }, include: { ProductionRequests: true } });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (batch.Status !== "Pending Approval") {
            return refuse(`Batch cannot be approved from status "${batch.Status}".`);
        }
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: { Status: "Approved" },
        });
        return { result: resourceResult({ success: true, message: "Production batch approved.", data: { batchId: updated.BatchId, status: updated.Status } }), audit: { module: "Production & Quality", action: "production_batch.stage_changed", subjectUsername: batch.ProductionRequests?.RequestedBy, target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} approved production batch (${String(id)})` }, after: () => notifyBatchRequester(batch, "approved") };
    }, { module: "Production & Quality", action: "record.updated", target: { type: "operation", id: String(idInput), name: "approveBatch" }, description: "Validation refused for approveBatch", version: auditVersion([idInput]) });
}
