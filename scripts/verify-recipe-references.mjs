import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { syncRecipeIngredients } from "../lib/resources/recipe-ingredients.ts";

// Only the named disposable database used by this verification is permitted.
// No application DATABASE_URL is read, and all created records are rolled back.
const rawUrl = process.env.IMS_RECIPE_TEST_DATABASE_URL;
assert.ok(rawUrl, "Set IMS_RECIPE_TEST_DATABASE_URL to the disposable test database");
const url = new URL(rawUrl);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "5439");
assert.equal(url.pathname, "/ims_ticket18");
const db = new PrismaClient({ datasources: { db: { url: rawUrl } } });
const rollback = new Error("Roll back successful verification fixtures");

try {
  await db.$transaction(async tx => {
    const suffix = crypto.randomUUID();
    const uom = await tx.unitOfMeasures.create({ data: {
      Name: "Verification kilogram", Abbreviation: "kg", Code: suffix, UomType: "Weight",
    } });
    const category = await tx.categories.create({ data: { CategoryName: "Ingredients", Description: "Verification only" } });
    const item = await tx.items.create({ data: { ItemName: "Reference test ingredient", UomId: uom.UomId,
      StockUomId: uom.UomId, CategoryId: category.CategoryId, MinStockLevel: 1, MaxStockLevel: 10, IsActive: true } });
    const removedItem = await tx.items.create({ data: { ItemName: "Removed test ingredient", UomId: uom.UomId,
      StockUomId: uom.UomId, CategoryId: category.CategoryId, MinStockLevel: 1, MaxStockLevel: 10, IsActive: true } });
    const addedItem = await tx.items.create({ data: { ItemName: "Added test ingredient", UomId: uom.UomId,
      StockUomId: uom.UomId, CategoryId: category.CategoryId, MinStockLevel: 1, MaxStockLevel: 10, IsActive: true } });
    const finishedCategory = await tx.categories.create({ data: { CategoryName: "Finished Good", Description: "Verification only" } });
    const finishedItem = await tx.items.create({ data: { ItemName: "Reference test product", UomId: uom.UomId,
      StockUomId: uom.UomId, CategoryId: finishedCategory.CategoryId, MinStockLevel: 1, MaxStockLevel: 10, IsActive: true } });
    const product = await tx.finishedProducts.create({ data: { ItemId: finishedItem.ItemId, SellingPrice: 1, Sku: suffix } });
    const recipe = await tx.recipes.create({ data: { ProductId: product.ProductId,
      RecipeName: "Reference test recipe", OutputQuantity: 10, Notes: "Keep these notes", IsActive: true,
      RecipeIngredients: { create: [
        { ItemId: item.ItemId, UomId: uom.UomId, StandardQuantity: 2 },
        { ItemId: removedItem.ItemId, UomId: uom.UomId, StandardQuantity: 1 },
      ] },
    }, include: { RecipeIngredients: true } });
    const ingredient = recipe.RecipeIngredients.find(row => row.ItemId === item.ItemId);
    assert.ok(ingredient);
    const location = await tx.locations.create({ data: { LocationName: "Verification location", LocationType: "Warehouse" } });
    const lot = await tx.inventoryLots.create({ data: { ItemId: item.ItemId, LocationId: location.LocationId,
      LotCode: suffix, SourceType: "Opening", ReceivedDate: new Date(), IsExpiryEstimated: false,
      QuantityReceived: 10, QuantityRemaining: 10, UomId: uom.UomId, UnitCost: 1, Status: "Available", IsOpeningBalance: true } });
    const request = await tx.productionRequests.create({ data: { ReqNumber: suffix,
      ProductId: product.ProductId, RecipeId: recipe.RecipeId, Quantity: 10, RequiredDate: new Date(), RequestedBy: "test.staff" } });
    const reservation = await tx.productionReqLotReservations.create({ data: { ProdReqId: request.ProdReqId,
      IngredientId: ingredient.IngredientId, ItemId: item.ItemId, LotId: lot.LotId, ReservedQuantity: 2 } });
    const issuance = await tx.materialIssuances.create({ data: {
      IssuanceNumber: suffix, ProdReqId: request.ProdReqId, IssuedBy: "test.staff",
    } });
    const scan = await tx.materialIssuanceScans.create({ data: { IssuanceId: issuance.IssuanceId,
      IngredientId: ingredient.IngredientId, ItemId: item.ItemId, LotId: lot.LotId,
      LotCode: lot.LotCode, ScannedBy: "test.staff" } });

    await syncRecipeIngredients(tx, recipe.RecipeId, recipe.RecipeIngredients,
      [{ itemId: item.ItemId, uomId: uom.UomId, standardQuantity: 4 },
        { itemId: addedItem.ItemId, uomId: uom.UomId, standardQuantity: 3 }]);
    await tx.recipes.update({ where: { RecipeId: recipe.RecipeId }, data: { OutputQuantity: 24 } });

    const updated = await tx.recipes.findUniqueOrThrow({ where: { RecipeId: recipe.RecipeId }, include: { RecipeIngredients: true } });
    assert.equal(Number(updated.OutputQuantity), 24);
    assert.equal(updated.Notes, "Keep these notes");
    const retained = updated.RecipeIngredients.find(row => row.ItemId === item.ItemId);
    assert.ok(retained);
    assert.equal(retained.IngredientId, ingredient.IngredientId);
    assert.equal(Number(retained.StandardQuantity), 4);
    assert.equal(updated.RecipeIngredients.length, 2);
    assert.ok(updated.RecipeIngredients.some(row => row.ItemId === addedItem.ItemId && Number(row.StandardQuantity) === 3));
    assert.ok(!updated.RecipeIngredients.some(row => row.ItemId === removedItem.ItemId));
    assert.equal((await tx.productionReqLotReservations.findUniqueOrThrow({ where: { ReservationId: reservation.ReservationId } })).IngredientId, ingredient.IngredientId);
    assert.equal((await tx.materialIssuanceScans.findUniqueOrThrow({ where: { ScanId: scan.ScanId } })).IngredientId, ingredient.IngredientId);
    throw rollback;
  }, { timeout: 15_000 });
} catch (error) {
  if (error !== rollback) throw error;
  console.log("PASS: used recipe edits preserve ingredient IDs, production reservations, issuance scans and notes. Fixtures rolled back.");
} finally {
  await db.$disconnect();
}
