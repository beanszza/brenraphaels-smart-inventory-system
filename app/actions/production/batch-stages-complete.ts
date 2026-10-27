"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
const COOKING_STAGES = [
    "Steaming",
    "Peeling",
    "Grinding",
    "Mixing",
    "Cooking",
    "Cooling",
] as const;
export async function completeBatchStage(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const stage = String(body.stage || "").trim();
        const endTime = String(body.endTime || "").trim();
        const notes = String(body.notes || "").trim();
        const completedBy = staff.username;
        if (!stage || !COOKING_STAGES.includes(stage as any)) {
            return refuse(`Invalid stage. Must be one of: ${COOKING_STAGES.join(", ")}`);
        }
        if (!endTime) {
            return refuse("End time is required to complete this stage.");
        }
        const batch = await tx.productionBatches.findUnique({
            where: { BatchId: id },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (["Rejected", "Completed", "Stocked In", "Cancelled", "For QA", "For Stock-in"].includes(batch.Status)) {
            return refuse("Cannot advance a rejected batch.");
        }
        const stageIdx = COOKING_STAGES.indexOf(stage as any);
        const nextStage = stageIdx < COOKING_STAGES.length - 1
            ? COOKING_STAGES[stageIdx + 1]
            : "Packaging"; // After Cooling -> Packaging
        const logEntry = `[STAGE:${stage}|END:${endTime}|BY:${completedBy}${notes ? `|NOTES:${notes}` : ""}]`;
        const updatedNotes = batch.Notes ? `${batch.Notes}\n${logEntry}` : logEntry;
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: {
                CurrentStage: nextStage,
                Stage: nextStage,
                Notes: updatedNotes,
            },
        });
        return { result: resourceResult({
                success: true,
                message: `Stage ${stage} completed successfully! Next stage: ${nextStage}`,
                data: {
                    batchId: updated.BatchId,
                    currentStage: updated.CurrentStage,
                    stage: updated.Stage,
                    notes: updated.Notes,
                },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} completed production batch stage (${String(id)})` } };
    });
}
