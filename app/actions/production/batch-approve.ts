"use server";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId } from "@/lib/production/mutate";
import { notifyBatchRequester } from "@/lib/production/notify";
export async function approveBatch(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id } });
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
        return { result: resourceResult({ success: true, message: "Production batch approved.", data: { batchId: updated.BatchId, status: updated.Status } }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} approved production batch (${String(id)})` }, after: () => notifyBatchRequester(batch, "approved") };
    });
}
