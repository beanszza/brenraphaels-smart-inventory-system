"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function commitBatchInventory(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const locationIdInput = body.locationId ? Number(body.locationId) : null;
        const notesInput = String(body.notes || "").trim();
        const batch = await tx.productionBatches.findUnique({
            where: { BatchId: id },
            include: {
                FinishedProducts: { include: { Items: true } },
                InventoryLots: true,
                ProductionRequests: true,
            },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (!["For Stock-in", "Passed QA", "Partial Pass"].includes(batch.Status)) {
            return refuse(`Batch cannot be committed to inventory from status "${batch.Status}". It must be cleared by QA first.`);
        }
        // Get the latest QualityInspection for this batch to get accepted quantity
        const inspection = await tx.qualityInspections.findFirst({
            where: { ReferenceId: id, ReferenceType: "ProductionBatch" },
            orderBy: { InspectionId: "desc" },
        });
        const acceptedQty = inspection
            ? Number(inspection.TotalAcceptedQuantity)
            : Number(batch.FinalQuantity || batch.ActualQuantity || batch.EstimatedQuantity || 0);
        if (acceptedQty <= 0) {
            return refuse("No accepted quantity to commit to inventory.");
        }
        // Find storage location
        const fgLocation = locationIdInput
            ? await tx.locations.findUnique({ where: { LocationId: locationIdInput } })
            : await tx.locations.findFirst({
                where: { IsActive: true },
                orderBy: { LocationId: "asc" },
            });
        if (!fgLocation) {
            return refuse("No active storage location found in the system.");
        }
        const itemId = batch.FinishedProducts?.ItemId || batch.ProductId;
        const now = new Date();
        const result = await (async () => {
            let activeLotId = batch.FgLotId;
            let finalLotCode = batch.InventoryLots?.LotCode;
            // 1. If FG lot was registered during packaging, update it to Available
            if (batch.FgLotId && batch.InventoryLots) {
                await tx.inventoryLots.update({
                    where: { LotId: batch.FgLotId },
                    data: {
                        Status: "Available",
                        QuantityRemaining: acceptedQty,
                        HoldReason: null,
                        LocationId: fgLocation.LocationId,
                    },
                });
            }
            else {
                // Create new lot if not already created
                const year = now.getFullYear();
                const lotSeq = await tx.documentSequences.upsert({
                    where: { DocType_Year: { DocType: "FGLot", Year: year } },
                    update: { LastNumber: { increment: 1 } },
                    create: { DocType: "FGLot", Year: year, LastNumber: 1 },
                });
                finalLotCode = `FG-${batch.BatchNumber}-${String(lotSeq.LastNumber).padStart(3, "0")}`;
                const createdLot = await tx.inventoryLots.create({
                    data: {
                        LotCode: finalLotCode,
                        ItemId: itemId,
                        LocationId: fgLocation.LocationId,
                        SourceType: "Production",
                        ProductionOrderId: id,
                        ReceivedDate: now,
                        ExpiryDate: batch.ExpiryDate,
                        IsExpiryEstimated: false,
                        QuantityReceived: acceptedQty,
                        QuantityRemaining: acceptedQty,
                        UomId: batch.FinishedProducts?.Items?.UomId || 1,
                        UnitCost: Number(batch.UnitCost),
                        Status: "Available",
                        IsOpeningBalance: false,
                    },
                });
                activeLotId = createdLot.LotId;
            }
            // 2. Update Inventories table (aggregate stock)
            const existingInventory = await tx.inventories.findFirst({
                where: { ItemId: itemId, LocationId: fgLocation.LocationId },
            });
            if (existingInventory) {
                await tx.inventories.update({
                    where: { InventoryId: existingInventory.InventoryId },
                    data: {
                        CurrentStock: { increment: acceptedQty },
                    },
                });
            }
            else {
                await tx.inventories.create({
                    data: {
                        ItemId: itemId,
                        LocationId: fgLocation.LocationId,
                        CurrentStock: acceptedQty,
                    },
                });
            }
            // 3. Create StockLedgers audit entry
            if (activeLotId) {
                await tx.stockLedgers.create({
                    data: {
                        ItemId: itemId,
                        LocationId: fgLocation.LocationId,
                        LotId: activeLotId,
                        MovementType: "IN",
                        Quantity: acceptedQty,
                        UomId: batch.FinishedProducts?.Items?.UomId || 1,
                        UnitCost: Number(batch.UnitCost || 0),
                        ReferenceType: "ProductionBatch",
                        ReferenceId: String(id),
                        UserId: staff.username,
                        UserName: staff.name,
                        PostedAt: now,
                        Notes: `Production batch committed to inventory. Lot: ${finalLotCode}${notesInput ? ` | Notes: ${notesInput}` : ""}`,
                    },
                });
            }
            // 4. Update Batch status to Stocked In / Completed
            const activityLog = `[ACTIVITY:${now.toISOString()}|TITLE:Committed to inventory: ${acceptedQty} units added to ${fgLocation.LocationName}|ACTOR:${staff.username}]`;
            const updatedNotes = batch.Notes ? `${batch.Notes}\n${activityLog}` : activityLog;
            const completedBatch = await tx.productionBatches.update({
                where: { BatchId: id },
                data: {
                    Status: "Stocked In",
                    CurrentStage: "Completed",
                    Stage: "Completed",
                    CompletedDate: now,
                    FgLotId: activeLotId,
                    Notes: updatedNotes,
                },
            });
            // 5. Update linked Production Request to Completed
            if (batch.ProdReqId) {
                await tx.productionRequests.update({
                    where: { ProdReqId: batch.ProdReqId },
                    data: {
                        Status: "Completed",
                        UpdatedAt: now,
                    },
                });
            }
            return { completedBatch, finalLotCode, acceptedQty };
        })();
        return { result: resourceResult({
                success: true,
                message: `Batch successfully committed to inventory! ${result.acceptedQty} units added under lot ${result.finalLotCode}.`,
                data: {
                    batchId: result.completedBatch.BatchId,
                    status: result.completedBatch.Status,
                    lotCode: result.finalLotCode,
                    quantityAdded: result.acceptedQty,
                    locationName: fgLocation.LocationName,
                },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} committed production batch to inventory (${String(id)})` } };
    });
}
