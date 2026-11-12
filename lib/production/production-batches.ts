/* eslint-disable @typescript-eslint/no-explicit-any -- Existing DTO helpers moved out of route exports. */
export function productInitialsCode(itemName?: string | null): string {
  const cleaned = String(itemName || "").trim();
  if (!cleaned) return "PROD";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    if (initials) return initials;
  }
  return cleaned.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6) || "PROD";
}

export function formatBatchNumber(batchNumber?: string | null, itemName?: string | null): string {
  const raw = String(batchNumber || "");
  if (!raw) return "";
  const initials = productInitialsCode(itemName);
  return raw.replace(/^BTH-FP\d+-(\d{8}-\d+)$/i, `BTH-${initials}-$1`);
}

export function mapBatch(b: any) {
  const product = b.FinishedProducts;
  const recipe = b.Recipes;
  const itemName = product?.Items?.ItemName ?? "";
  const itemCode = product?.Items?.ItemCode ?? "";

  return {
    batchId: b.BatchId,
    batchNumber: formatBatchNumber(b.BatchNumber, itemName),
    prodReqId: b.ProdReqId,
    reqNumber: b.ProductionRequests?.ReqNumber ?? "",
    productId: b.ProductId,
    productName: itemName,
    productCode: itemCode,
    variant: product?.Variant ?? "",
    sku: product?.Sku ?? "",
    recipeId: b.RecipeId,
    recipeName: recipe?.RecipeName ?? "",
    recipeCode: recipe?.RecipeCode ?? "",
    yieldUom: recipe?.UnitOfMeasures?.Abbreviation ?? "",
    batchMultiplier: Number(b.BatchMultiplier),
    estimatedQuantity: Number(b.EstimatedQuantity),
    actualQuantity: Number(b.ActualQuantity),
    finalQuantity: Number(b.FinalQuantity ?? 0),
    scrapQuantity: Number(b.ScrapQuantity),
    scrapReason: b.ScrapReason ?? "",
    productionDate: b.ProductionDate ? b.ProductionDate.toISOString() : null,
    startedAt: b.StartedAt ? b.StartedAt.toISOString() : null,
    completedDate: b.CompletedDate ? b.CompletedDate.toISOString() : null,
    packagedAt: b.PackagedAt ? b.PackagedAt.toISOString() : null,
    packagedBy: b.PackagedBy ?? "",
    expiryDate: b.ExpiryDate ? b.ExpiryDate.toISOString() : null,
    stage: b.CurrentStage || b.Stage,
    currentStage: b.CurrentStage || b.Stage,
    qualityStatus: b.QualityStatus,
    rejectionReason: b.RejectionReason ?? "",
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
  };
}

export const BATCH_INCLUDE = {
  FinishedProducts: {
    include: {
      Items: true,
    },
  },
  Recipes: {
    include: {
      UnitOfMeasures: true,
    },
  },
  InventoryLots: true,
  ProductionRequests: true,
  BatchConsumptions: {
    include: {
      Items: true,
      UnitOfMeasures: true,
      InventoryLots: true,
    },
  },
};
