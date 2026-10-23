import type { Prisma } from "@prisma/client";
import type { RecipeInput } from "./inputs";

/** Keep retained IDs stable because production records reference IngredientId. */
export async function syncRecipeIngredients(
  tx: Prisma.TransactionClient,
  recipeId: number,
  existing: { IngredientId: number; ItemId: number }[],
  requested: RecipeInput["ingredients"],
) {
  const requestedItems = new Set(requested.map(ingredient => ingredient.itemId));
  const removedIds = existing.filter(ingredient => !requestedItems.has(ingredient.ItemId))
    .map(ingredient => ingredient.IngredientId);
  if (removedIds.length) {
    // Referenced removals remain subject to the database's foreign-key protection.
    // The caller's transaction rolls back the entire edit if removal is disallowed.
    await tx.recipeIngredients.deleteMany({
      where: { RecipeId: recipeId, IngredientId: { in: removedIds } },
    });
  }
  const byItem = new Map(existing.map(ingredient => [ingredient.ItemId, ingredient]));
  for (const ingredient of requested) {
    const retained = byItem.get(ingredient.itemId);
    const data = { UomId: ingredient.uomId, StandardQuantity: ingredient.standardQuantity };
    if (retained) {
      await tx.recipeIngredients.update({ where: { IngredientId: retained.IngredientId }, data });
    } else {
      await tx.recipeIngredients.create({ data: { RecipeId: recipeId, ItemId: ingredient.itemId, ...data } });
    }
  }
}
