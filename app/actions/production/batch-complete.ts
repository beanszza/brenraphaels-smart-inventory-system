"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { BATCH_INCLUDE, mapBatch } from "@/lib/production/production-batches";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function completeBatch(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const finalQuantity = Number(body.finalQuantity);
        const packagedBy = staff.username;
        const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
        const scrapQuantity = Number(body.scrapQuantity) || 0;
        const scrapReason = body.scrapReason || "";
        const notes = body.notes || "";
        if (!finalQuantity || finalQuantity <= 0) {
            return refuse("Final output quantity must be greater than 0.");
        }
        const batch = await tx.productionBatches.findUnique({
            where: { BatchId: id },
            include: {
                FinishedProducts: {
                    include: { Items: true },
                },
                ProductionRequests: true,
            },
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (batch.FgLotId || ["Rejected", "Cancelled", "Stocked In"].includes(batch.Status))
            refuse("This batch already has a finished goods lot or is closed.");
        if (batch.Status === "Completed") {
            return refuse("Batch has already been completed.");
        }
        // Determine FG location: look for LocationType === 'Finished Goods' or fallback to LocationId 4 or 1
        const fgLocation = await tx.locations.findFirst({
            where: { LocationType: { contains: "Finished Goods", mode: "insensitive" } },
        });
        const fgLocationId = fgLocation?.LocationId ?? 4;
        const itemId = batch.FinishedProducts.ItemId;
        const uomId = batch.FinishedProducts.Items.UomId;
        const unitCost = Number(batch.UnitCost) || 0;
        const fgLotCode = `FG-${batch.BatchNumber}`;
        const now = new Date();
        const completedResult = await (async () => {
            // 1. Create FG InventoryLot
            const fgLot = await tx.inventoryLots.create({
                data: {
                    LotCode: fgLotCode,
                    ItemId: itemId,
                    LocationId: fgLocationId,
                    SourceType: "Production",
                    ProductionOrderId: batch.BatchId,
                    ReceivedDate: now,
                    ManufactureDate: now,
                    ExpiryDate: expiryDate,
                    IsExpiryEstimated: false,
                    QuantityReceived: finalQuantity,
                    QuantityRemaining: finalQuantity,
                    ReservedQuantity: 0,
                    UomId: uomId,
                    UnitCost: unitCost,
                    Status: "Active",
                    IsOpeningBalance: false,
                },
            });
            // 2. Increment CurrentStock on Inventories
            await tx.inventories.upsert({
                where: {
                    ItemId_LocationId: {
                        ItemId: itemId,
                        LocationId: fgLocationId,
                    },
                },
                update: {
                    CurrentStock: { increment: finalQuantity },
                },
                create: {
                    ItemId: itemId,
                    LocationId: fgLocationId,
                    CurrentStock: finalQuantity,
                },
            });
            // 3. Post StockLedgers entry
            await tx.stockLedgers.create({
                data: {
                    LotId: fgLot.LotId,
                    ItemId: itemId,
                    LocationId: fgLocationId,
                    MovementType: "PRODUCTION_FG_STOCKIN",
                    Quantity: finalQuantity,
                    UomId: uomId,
                    UnitCost: unitCost,
                    ReferenceType: "ProductionBatch",
                    ReferenceId: batch.BatchNumber,
                    UserId: packagedBy,
                    UserName: staff.name,
                    PostedAt: now,
                    Notes: `Finished goods stock-in from completed Batch ${batch.BatchNumber}`,
                },
            });
            // 4. Update Batch
            const updatedBatch = await tx.productionBatches.update({
                where: { BatchId: id },
                data: {
                    Status: "Completed",
                    Stage: "Completed",
                    CurrentStage: "Completed",
                    CompletedDate: now,
                    ActualQuantity: finalQuantity,
                    FgLotId: fgLot.LotId,
                    PackagedBy: packagedBy,
                    PackagedAt: now,
                    ExpiryDate: expiryDate,
                    ScrapQuantity: scrapQuantity,
                    ScrapReason: scrapReason,
                    Notes: notes ? (batch.Notes ? `${batch.Notes}\n[Completion] ${notes}` : notes) : batch.Notes,
                },
                include: BATCH_INCLUDE,
            });
            // 5. Update linked ProductionRequest if exists
            if (batch.ProdReqId) {
                await tx.productionRequests.update({
                    where: { ProdReqId: batch.ProdReqId },
                    data: {
                        Status: "Completed",
                        UpdatedAt: now,
                    },
                });
            }
            return { batch: updatedBatch, fgLot };
        })();
        return { result: resourceResult({
                success: true,
                message: `Production Batch ${batch.BatchNumber} completed successfully. Finished Goods lot ${fgLotCode} created with ${finalQuantity} units.`,
                data: {
                    batch: mapBatch(completedResult.batch),
                    fgLot: {
                        lotId: completedResult.fgLot.LotId,
                        lotCode: completedResult.fgLot.LotCode,
                        quantity: Number(completedResult.fgLot.QuantityReceived),
                        expiryDate: completedResult.fgLot.ExpiryDate ? completedResult.fgLot.ExpiryDate.toISOString() : null,
                    },
                },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} completed production batch (${String(id)})` } };
    });
}
