"use server";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId } from "@/lib/production/mutate";
const CANCELLABLE = ["Pending Approval", "Approved", "In Progress"];
export async function cancelBatch(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id } });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (!CANCELLABLE.includes(batch.Status)) {
            return refuse(`Batch with status "${batch.Status}" cannot be cancelled.`);
        }
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: { Status: "Cancelled" },
        });
        return { result: resourceResult({ success: true, message: "Batch cancelled.", data: { batchId: updated.BatchId, status: updated.Status } }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} cancelled production batch (${String(id)})` } };
    });
}
