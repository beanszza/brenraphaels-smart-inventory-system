"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { isFileId } from "@/lib/files";
import { notifyApprovalRequested } from "@/lib/production/notify";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
export async function packageBatch(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const packageDate = body.packageDate ? new Date(body.packageDate) : new Date();
        const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
        const packedBy = staff.username;
        const proofImageUrl = String(body.proofImageUrl || "").trim();
        const finalQuantity = Number(body.finalQuantity);
        const notes = String(body.notes || "").trim();
        // Input Validations
        if (!proofImageUrl) {
            return refuse("Proof of packaging (photo attachment) is required.");
        }
        if (isNaN(finalQuantity) || finalQuantity <= 0) {
            return refuse("A valid final packed quantity greater than zero is required.");
        }
        if (!expiryDate) {
            return refuse("Product expiry date is required.");
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
        if (!isFileId(proofImageUrl) || proofImageUrl !== batch.ImageUrl)
            refuse("Upload and confirm a packaging photo for this batch first.");
        if (batch.FgLotId || ["For QA", "For Stock-in", "Stocked In", "Completed", "Cancelled"].includes(batch.Status))
            refuse("This batch has already been packaged or closed.");
        if (batch.Status === "Rejected") {
            return refuse("Cannot package a rejected batch.");
        }
        // Auto-generate Finished Goods Lot Number: [PROD_INITIALS]-[YYMMDD]-[DAILY_SEQ]
        // Example: Calamansi Chili Sauce -> CCS-261008-01
        const productName = batch.FinishedProducts?.Items?.ItemName || "PROD";
        const initials = productName
            .split(/\s+/)
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 4) || "FG";
        const now = new Date();
        const year = now.getFullYear();
        const yy = String(year).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const yymmdd = `${yy}${mm}${dd}`;
        const seqDocType = `FG_LOT_${initials}_${yymmdd}`;
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: seqDocType, Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: seqDocType, Year: year, LastNumber: 1 },
        });
        const fgLotCode = `${initials}-${yymmdd}-${String(seq.LastNumber).padStart(2, "0")}`;
        const reqQty = Number(batch.ProductionRequests?.Quantity || batch.EstimatedQuantity);
        const yieldPercentage = reqQty > 0 ? (finalQuantity / reqQty) * 100 : 100;
        // Get location for Finished Goods lot creation (e.g. location 1 or system warehouse)
        const defaultLocation = await tx.locations.findFirst({
            where: { IsActive: true },
            orderBy: { LocationId: "asc" },
        });
        const locationId = defaultLocation?.LocationId || 1;
        const result = await (async () => {
            // 1. Create or register InventoryLot for the Finished Goods Lot
            const fgLot = await tx.inventoryLots.create({
                data: {
                    LotCode: fgLotCode,
                    ItemId: batch.FinishedProducts?.ItemId || batch.ProductId,
                    LocationId: locationId,
                    SourceType: "Production",
                    ReceivedDate: now,
                    ManufactureDate: packageDate,
                    ExpiryDate: expiryDate,
                    IsExpiryEstimated: false,
                    QuantityReceived: finalQuantity,
                    QuantityRemaining: 0, // Unreleased until passed QA & Committed to inventory!
                    ReservedQuantity: 0,
                    UomId: batch.FinishedProducts?.Items?.UomId || 1,
                    UnitCost: batch.UnitCost || 0,
                    Status: "Pending QA",
                    HoldReason: "Pending Quality Assurance Clearance",
                    IsOpeningBalance: false,
                },
            });
            const activityLog = `[ACTIVITY:${now.toISOString()}|TITLE:Production finished: packed ${finalQuantity.toLocaleString()} of ${reqQty.toLocaleString()} jars, sent to QA|ACTOR:${packedBy}]`;
            const updatedNotes = [batch.Notes, activityLog, notes ? `[Packaging] ${notes}` : ""].filter(Boolean).join("\n");
            // 2. Update Production Batch
            const updatedBatch = await tx.productionBatches.update({
                where: { BatchId: id },
                data: {
                    PackagedAt: packageDate,
                    PackagedBy: packedBy,
                    ExpiryDate: expiryDate,
                    FinalQuantity: finalQuantity,
                    ActualQuantity: finalQuantity,
                    YieldPercentage: yieldPercentage,
                    ImageUrl: proofImageUrl,
                    FgLotId: fgLot.LotId,
                    CurrentStage: "For QA",
                    Stage: "Packaging",
                    Status: "For QA",
                    Notes: updatedNotes,
                },
            });
            // 3. Update linked Production Request status
            if (batch.ProdReqId) {
                await tx.productionRequests.update({
                    where: { ProdReqId: batch.ProdReqId },
                    data: {
                        Status: "For QA",
                        UpdatedAt: now,
                    },
                });
            }
            return { updatedBatch, fgLot };
        })();
        return { result: resourceResult({
                success: true,
                message: `Packaging completed! Finished Goods Lot ${fgLotCode} registered and sent to QA.`,
                data: {
                    batchId: result.updatedBatch.BatchId,
                    fgLotCode: fgLotCode,
                    fgLotId: result.fgLot.LotId,
                    status: result.updatedBatch.Status,
                    yieldPercentage: result.updatedBatch.YieldPercentage,
                    finalQuantity: result.updatedBatch.FinalQuantity,
                },
            }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id, name: batch.BatchNumber }, description: `${staff.name} packaged batch ${batch.BatchNumber} for QA` }, after: () => notifyApprovalRequested(staff, batch.BatchNumber) };
    });
}
