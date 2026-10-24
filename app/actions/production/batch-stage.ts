"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { BATCH_INCLUDE, mapBatch } from "@/lib/production/production-batches";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
const PRODUCTION_STAGES = [
    "Pre-Production",
    "Peeling",
    "Steaming",
    "Mixing/Grinding",
    "Cooking",
    "Cooling",
    "Packaging",
    "Completed",
] as const;
export async function advanceBatchStage(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const targetStage = body.stage;
        const notes = body.notes;
        if (!targetStage || !PRODUCTION_STAGES.includes(targetStage)) {
            return refuse(`Invalid stage. Must be one of: ${PRODUCTION_STAGES.join(", ")}`);
        }
        const batch = await tx.productionBatches.findUnique({
            where: { BatchId: id },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (["Completed", "Rejected", "Cancelled", "Stocked In"].includes(batch.Status)) {
            return refuse("This batch has already been completed.");
        }
        const updateData: any = {
            Stage: targetStage,
            CurrentStage: targetStage,
        };
        if (notes) {
            updateData.Notes = batch.Notes ? `${batch.Notes}\n[${targetStage}] ${notes}` : `[${targetStage}] ${notes}`;
        }
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: updateData,
            include: BATCH_INCLUDE,
        });
        return { result: resourceResult({
                success: true,
                message: `Batch stage advanced to ${targetStage}.`,
                data: mapBatch(updated),
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} advanced production batch stage (${String(id)})` } };
    });
}
