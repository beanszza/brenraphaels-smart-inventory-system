/* eslint-disable @typescript-eslint/no-explicit-any -- Existing DTO helpers moved out of route exports. */
export function mapMaterialIssuance(iss: any) {
  const req = iss.ProductionRequests;
  const product = req?.FinishedProducts;
  const recipe = req?.Recipes;

  return {
    issuanceId: iss.IssuanceId,
    issuanceNumber: iss.IssuanceNumber,
    prodReqId: iss.ProdReqId,
    reqNumber: req?.ReqNumber ?? "",
    productName: product?.Items?.ItemName ?? "",
    productCode: product?.Items?.ItemCode ?? "",
    sku: product?.Sku ?? "",
    recipeName: recipe?.RecipeName ?? "",
    requestQuantity: Number(req?.Quantity ?? 0),
    priority: req?.Priority ?? "Normal",
    issuedBy: iss.IssuedBy ?? "",
    issuedAt: iss.IssuedAt ? iss.IssuedAt.toISOString() : null,
    status: iss.Status ?? "Pending",
    reqStatus: req?.Status ?? "",
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
    reservations: (req?.ProductionReqLotReservations ?? []).map((res: any) => ({
      reservationId: res.ReservationId,
      ingredientId: res.IngredientId,
      itemId: res.ItemId,
      itemName: res.Items?.ItemName ?? "",
      itemCode: res.Items?.ItemCode ?? "",
      lotId: res.LotId,
      lotCode: res.InventoryLots?.LotCode ?? "",
      reservedQuantity: Number(res.ReservedQuantity),
      isReleased: res.IsReleased,
      expiryDate: res.InventoryLots?.ExpiryDate ? res.InventoryLots.ExpiryDate.toISOString() : null,
    })),
  };
}

export const ISSUANCE_INCLUDE = {
  ProductionRequests: {
    include: {
      FinishedProducts: {
        include: {
          Items: true,
        },
      },
      Recipes: {
        include: {
          RecipeIngredients: {
            include: {
              Items: true,
              Uom: true,
            },
          },
        },
      },
      ProductionReqLotReservations: {
        include: {
          Items: true,
          InventoryLots: true,
        },
      },
    },
  },
  MaterialIssuanceScans: {
    include: {
      Items: true,
      InventoryLots: true,
    },
  },
};
