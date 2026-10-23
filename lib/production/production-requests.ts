/* eslint-disable @typescript-eslint/no-explicit-any -- Existing DTO helpers moved out of route exports. */
export function mapProductionRequest(r: any) {
  const product = r.FinishedProducts;
  const recipe = r.Recipes;
  const itemName = product?.Items?.ItemName ?? "";
  const itemCode = product?.Items?.ItemCode ?? "";

  return {
    prodReqId: r.ProdReqId,
    reqNumber: r.ReqNumber,
    productId: r.ProductId,
    productName: itemName,
    productCode: itemCode,
    sku: product?.Sku ?? "",
    variant: product?.Variant ?? "",
    recipeId: r.RecipeId,
    recipeName: recipe?.RecipeName ?? "",
    recipeCode: recipe?.RecipeCode ?? "",
    recipeOutputQty: Number(recipe?.OutputQuantity ?? 0),
    yieldUom: recipe?.UnitOfMeasures?.Abbreviation ?? "",
    quantity: Number(r.Quantity),
    reason: r.Reason ?? "",
    priority: r.Priority ?? "Normal",
    requiredDate: r.RequiredDate ? r.RequiredDate.toISOString() : null,
    requiredTime: r.RequiredTime ?? "",
    requestedBy: r.RequestedBy ?? "",
    status: r.Status ?? "Draft",
    linkedPrId: r.LinkedPrId,
    linkedPrNumber: r.PurchaseRequisitions?.PrNumber ?? null,
    adminNotes: r.AdminNotes ?? "",
    approvedBy: r.ApprovedBy ?? "",
    approvedAt: r.ApprovedAt ? r.ApprovedAt.toISOString() : null,
    rejectedBy: r.RejectedBy ?? "",
    rejectedAt: r.RejectedAt ? r.RejectedAt.toISOString() : null,
    rejectionReason: r.RejectionReason ?? "",
    createdAt: r.CreatedAt ? r.CreatedAt.toISOString() : null,
    updatedAt: r.UpdatedAt ? r.UpdatedAt.toISOString() : null,
    recipeIngredients: (recipe?.RecipeIngredients ?? []).map((ing: any) => ({
      ingredientId: ing.IngredientId,
      itemId: ing.ItemId,
      itemName: ing.Items?.ItemName ?? "",
      itemCode: ing.Items?.ItemCode ?? "",
      standardQuantity: Number(ing.StandardQuantity),
      uomId: ing.UomId,
      uomAbbr: ing.Uom?.Abbreviation ?? ing.Items?.Uom?.Abbreviation ?? "",
    })),
    reservations: (r.ProductionReqLotReservations ?? []).map((res: any) => ({
      reservationId: res.ReservationId,
      ingredientId: res.IngredientId,
      itemId: res.ItemId,
      itemName: res.Items?.ItemName ?? "",
      lotId: res.LotId,
      lotCode: res.InventoryLots?.LotCode ?? "",
      reservedQuantity: Number(res.ReservedQuantity),
      isReleased: res.IsReleased,
      releasedAt: res.ReleasedAt ? res.ReleasedAt.toISOString() : null,
      expiryDate: res.InventoryLots?.ExpiryDate ? res.InventoryLots.ExpiryDate.toISOString() : null,
      quantityRemaining: Number(res.InventoryLots?.QuantityRemaining ?? 0),
    })),
    issuances: (r.MaterialIssuances ?? []).map((iss: any) => ({
      issuanceId: iss.IssuanceId,
      issuanceNumber: iss.IssuanceNumber,
      issuedBy: iss.IssuedBy,
      issuedAt: iss.IssuedAt ? iss.IssuedAt.toISOString() : null,
      status: iss.Status,
      scans: (iss.MaterialIssuanceScans ?? []).map((s: any) => ({
        scanId: s.ScanId,
        ingredientId: s.IngredientId,
        itemId: s.ItemId,
        lotId: s.LotId,
        lotCode: s.LotCode,
        scannedAt: s.ScannedAt ? s.ScannedAt.toISOString() : null,
        scannedBy: s.ScannedBy,
        isVerified: s.IsVerified,
      })),
    })),
    batches: (r.ProductionBatches ?? []).map((b: any) => ({
      batchId: b.BatchId,
      batchNumber: b.BatchNumber,
      status: b.Status,
      stage: b.CurrentStage || b.Stage,
      currentStage: b.CurrentStage || b.Stage,
      estimatedQuantity: Number(b.EstimatedQuantity),
      actualQuantity: Number(b.ActualQuantity),
      productionDate: b.ProductionDate ? b.ProductionDate.toISOString() : null,
      startedAt: b.StartedAt ? b.StartedAt.toISOString() : null,
      completedDate: b.CompletedDate ? b.CompletedDate.toISOString() : null,
    })),
  };
}

export const PROD_REQ_INCLUDE = {
  FinishedProducts: {
    include: {
      Items: true,
    },
  },
  Recipes: {
    include: {
      UnitOfMeasures: true,
      RecipeIngredients: {
        include: {
          Items: {
            include: {
              Uom: true,
            },
          },
          Uom: true,
        },
      },
    },
  },
  PurchaseRequisitions: true,
  ProductionReqLotReservations: {
    include: {
      InventoryLots: true,
      Items: true,
    },
  },
  MaterialIssuances: {
    include: {
      MaterialIssuanceScans: true,
    },
  },
  ProductionBatches: true,
};
