"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { mapBatch, BATCH_INCLUDE } from "@/lib/production/production-batches";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, validateInput } from "@/lib/production/mutate";
export async function listBatches(query = "") {
    await requireModule("Production & Quality");
    return read(async () => {
        const searchParams = new URLSearchParams(query);
        const status = searchParams.get("status") || "All";
        const stage = searchParams.get("stage") || "All";
        const search = searchParams.get("search")?.trim().toLowerCase() || "";
        const where: any = {};
        if (status !== "All")
            where.Status = status;
        if (stage !== "All")
            where.CurrentStage = stage;
        if (search) {
            where.OR = [
                { BatchNumber: { contains: search, mode: "insensitive" } },
                { AssignedCook: { contains: search, mode: "insensitive" } },
                { FinishedProducts: { Items: { ItemName: { contains: search, mode: "insensitive" } } } },
                { Recipes: { RecipeName: { contains: search, mode: "insensitive" } } },
            ];
        }
        const batches = await prisma.productionBatches.findMany({
            where,
            include: BATCH_INCLUDE,
            orderBy: { BatchId: "desc" },
        });
        return resourceResult({
            success: true,
            data: batches.map(mapBatch),
        });
    });
}
export async function createBatch(body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        validateInput(body);
        const prodReqId = Number(body.prodReqId);
        if (!prodReqId) {
            return refuse("Production Request ID (prodReqId) is required to start a batch.");
        }
        const prodReq = await tx.productionRequests.findUnique({
            where: { ProdReqId: prodReqId },
            include: {
                FinishedProducts: {
                    include: { Items: true },
                },
                Recipes: {
                    include: {
                        RecipeIngredients: {
                            include: { Items: true, Uom: true },
                        },
                    },
                },
                ProductionReqLotReservations: {
                    include: {
                        InventoryLots: true,
                    },
                },
            },
        });
        if (!prodReq) {
            return refuse("Production request not found.");
        }
        if (prodReq.Status !== "Materials Issued") {
            return refuse(`Only requests with 'Materials Issued' status can be started. Current status: ${prodReq.Status}`);
        }
        // Determine product code for batch number
        const rawCode = prodReq.FinishedProducts?.Items?.ItemCode || prodReq.FinishedProducts?.Items?.ItemName || "PROD";
        const productCode = rawCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
        const now = new Date();
        const year = now.getFullYear();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
        // Unique sequence per product code + year
        const docType = `Batch_${productCode}`;
        const seq = await tx.documentSequences.upsert({
            where: { DocType_Year: { DocType: docType, Year: year } },
            update: { LastNumber: { increment: 1 } },
            create: { DocType: docType, Year: year, LastNumber: 1 },
        });
        // Format: BTH-PRODUCTCODE-YYYYMMDD-XXXX
        const batchNumber = `BTH-${productCode}-${dateStr}-${String(seq.LastNumber).padStart(4, "0")}`;
        const multiplier = Number(prodReq.Recipes.OutputQuantity) > 0
            ? Number(prodReq.Quantity) / Number(prodReq.Recipes.OutputQuantity)
            : 1;
        // Build consumptions from reservations or recipe ingredients
        const consumptionsData: any[] = [];
        if (prodReq.ProductionReqLotReservations.length > 0) {
            for (const res of prodReq.ProductionReqLotReservations) {
                consumptionsData.push({
                    ItemId: res.ItemId,
                    RequiredQuantity: res.ReservedQuantity,
                    QuantityUsed: res.ReservedQuantity,
                    UomId: res.InventoryLots?.UomId ?? null,
                    LotId: res.LotId,
                    UnitCost: res.InventoryLots?.UnitCost ?? 0,
                });
            }
        }
        else {
            for (const ing of prodReq.Recipes.RecipeIngredients) {
                consumptionsData.push({
                    ItemId: ing.ItemId,
                    RequiredQuantity: Number(ing.StandardQuantity) * multiplier,
                    QuantityUsed: Number(ing.StandardQuantity) * multiplier,
                    UomId: ing.UomId,
                    UnitCost: 0,
                });
            }
        }
        const createdBatch = await (async () => {
            const batch = await tx.productionBatches.create({
                data: {
                    ProdReqId: prodReq.ProdReqId,
                    RecipeId: prodReq.RecipeId,
                    ProductId: prodReq.ProductId,
                    BatchMultiplier: multiplier,
                    EstimatedQuantity: Number(prodReq.Quantity),
                    ActualQuantity: 0,
                    ProductionDate: now,
                    StartedAt: now,
                    Stage: "Pre-Production",
                    CurrentStage: "Pre-Production",
                    QualityStatus: "Pending",
                    RejectionReason: "",
                    ImageUrl: "",
                    Notes: body.notes || prodReq.Reason || "",
                    Purpose: "Production Request Fulfillment",
                    AssignedCook: staff.username,
                    Status: "In Production",
                    BatchNumber: batchNumber,
                    ScrapQuantity: 0,
                    BatchConsumptions: {
                        create: consumptionsData,
                    },
                },
                include: BATCH_INCLUDE,
            });
            // Update ProductionRequests status
            await tx.productionRequests.update({
                where: { ProdReqId: prodReq.ProdReqId },
                data: {
                    Status: "In Production",
                    UpdatedAt: now,
                },
            });
            return batch;
        })();
        return { result: resourceResult({
                success: true,
                message: `Production Batch ${createdBatch.BatchNumber} created and started.`,
                data: mapBatch(createdBatch),
            }), audit: { module: "Production & Quality", change: "created", target: { type: "production-batch", id: createdBatch.BatchId, name: createdBatch.BatchNumber }, description: `${staff.name} created production batch (${createdBatch.BatchNumber})` } };
    });
}
