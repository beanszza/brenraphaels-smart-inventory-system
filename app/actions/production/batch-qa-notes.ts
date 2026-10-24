"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function updateQaNotes(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id } });
        if (!batch) {
            return refuse("Batch not found.");
        }
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: {
                Notes: body.notes ?? batch.Notes,
            },
        });
        return { result: resourceResult({
                success: true,
                message: "QA notes updated.",
                data: { batchId: updated.BatchId, notes: updated.Notes },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} updated QA notes for batch (${String(id)})` } };
    });
}
