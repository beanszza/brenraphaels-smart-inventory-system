"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/production/mutate";
const BATCH_INCLUDE = {
    FinishedProducts: {
        include: { Items: true },
    },
    Recipes: {
        include: { UnitOfMeasures: true },
    },
    ProductionRequests: {
        include: {
            ProductionReqLotReservations: {
                include: {
                    InventoryLots: true,
                    Items: true,
                },
            },
        },
    },
    InventoryLots: true,
    BatchConsumptions: {
        include: {
            Items: true,
            UnitOfMeasures: true,
            InventoryLots: true,
        },
    },
};
function mapBatch(b: any) {
    const product = b.FinishedProducts;
    const recipe = b.Recipes;
    const prodReq = b.ProductionRequests;
    return {
        batchId: b.BatchId,
        batchNumber: b.BatchNumber,
        prodReqId: b.ProdReqId,
        reqNumber: prodReq?.ReqNumber ?? "",
        requestedBy: prodReq?.RequestedBy ?? "",
        approvedBy: prodReq?.ApprovedBy ?? "",
        requestedQty: Number(prodReq?.Quantity ?? b.EstimatedQuantity),
        productId: b.ProductId,
        productName: product?.Items?.ItemName ?? "",
        productCode: product?.Items?.ItemCode ?? "",
        variant: product?.Variant ?? "",
        sku: product?.Sku ?? "",
        recipeId: b.RecipeId,
        recipeName: recipe?.RecipeName ?? "",
        yieldUom: recipe?.UnitOfMeasures?.Abbreviation ?? "units",
        batchMultiplier: Number(b.BatchMultiplier),
        estimatedQuantity: Number(b.EstimatedQuantity),
        actualQuantity: Number(b.ActualQuantity),
        finalQuantity: Number(b.FinalQuantity ?? 0),
        scrapQuantity: Number(b.ScrapQuantity),
        scrapReason: b.ScrapReason ?? "",
        productionDate: b.ProductionDate?.toISOString() ?? null,
        startedAt: b.StartedAt?.toISOString() ?? null,
        completedDate: b.CompletedDate?.toISOString() ?? null,
        packagedAt: b.PackagedAt?.toISOString() ?? null,
        packagedBy: b.PackagedBy ?? "",
        expiryDate: b.ExpiryDate?.toISOString() ?? null,
        stage: b.CurrentStage || b.Stage,
        currentStage: b.CurrentStage || b.Stage,
        qualityStatus: b.QualityStatus,
        rejectionReason: b.RejectionReason ?? "",
        imageUrl: b.ImageUrl ?? "",
        notes: b.Notes ?? "",
        purpose: b.Purpose,
        status: b.Status,
        assignedCook: b.AssignedCook,
        fgLotId: b.FgLotId ?? null,
        fgLotCode: b.InventoryLots?.LotCode ?? "",
        totalMaterialCost: Number(b.TotalMaterialCost),
        unitCost: Number(b.UnitCost),
        yieldPercentage: Number(b.YieldPercentage),
        consumptions: (b.BatchConsumptions ?? []).map((c: any) => ({
            consumptionId: c.BatchConsumptionId,
            itemId: c.ItemId,
            itemName: c.Items?.ItemName ?? "",
            requiredQuantity: Number(c.RequiredQuantity),
            quantityUsed: Number(c.QuantityUsed),
            uomId: c.UomId,
            uomAbbr: c.UnitOfMeasures?.Abbreviation ?? "",
            lotId: c.LotId ?? null,
            lotCode: c.InventoryLots?.LotCode ?? "",
            unitCost: Number(c.UnitCost),
        })),
        reservations: (prodReq?.ProductionReqLotReservations ?? []).map((res: any) => ({
            reservationId: res.ReservationId,
            ingredientId: res.IngredientId,
            itemId: res.ItemId,
            itemName: res.Items?.ItemName ?? "",
            lotId: res.LotId,
            lotCode: res.InventoryLots?.LotCode ?? "",
            reservedQuantity: Number(res.ReservedQuantity),
        })),
    };
}
export async function getBatch(idInput: string | number) {
    await requireModule("Production & Quality");
    return read(async () => {
        const id = positiveId(idInput);
        const batch = await prisma.productionBatches.findUnique({
            where: { BatchId: id },
            include: BATCH_INCLUDE,
        });
        if (!batch) {
            return refuse("Batch not found.");
        }
        return resourceResult({ success: true, data: mapBatch(batch) });
    });
}
export async function updateBatch(idInput: string | number, body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        validateInput(body);
        const updated = await tx.productionBatches.update({
            where: { BatchId: id },
            data: {
                ...(body.notes !== undefined && { Notes: body.notes }),
                ...(body.purpose !== undefined && { Purpose: body.purpose }),
                ...(body.scheduleDate !== undefined && { ProductionDate: new Date(body.scheduleDate) }),
            },
            include: BATCH_INCLUDE,
        });
        return { result: resourceResult({ success: true, data: mapBatch(updated) }), audit: { module: "Production & Quality", change: "updated", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} updated production batch (${String(id)})` } };
    });
}
export async function deleteBatch(idInput: string | number) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        const id = positiveId(idInput);
        const batch = await tx.productionBatches.findUnique({ where: { BatchId: id } });
        if (!batch) {
            return refuse("Batch not found.");
        }
        if (!["Draft", "Pending Approval", "Rejected"].includes(batch.Status)) {
            return refuse("Only Draft, Pending Approval, or Rejected batches can be deleted.");
        }
        await tx.productionBatches.delete({ where: { BatchId: id } });
        return { result: resourceResult({ success: true, message: "Batch deleted." }), audit: { module: "Production & Quality", change: "deleted", target: { type: "production-batch", id: id, name: String(id) }, description: `${staff.name} deleted production batch (${String(id)})` } };
    });
}
