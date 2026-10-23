"use server";

import { syncRecipeIngredients } from "@/lib/resources/recipe-ingredients";

import type { RecipeInput } from "@/lib/resources/inputs";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { resourceResult, errorMessage } from "@/lib/resources/result";

export async function listRecipes() {
  await requireModule("Resources & Suppliers");

  try {
    const recipes = await prisma.recipes.findMany({
      include: {
        RecipeIngredients: {
          include: {
            Items: true,
            Uom: true,
          }
        },
        Product: {
          include: {
            Items: {
              include: {
                Uom: true,
              }
            }
          }
        }
      }
    });

    const responseData = recipes.map(recipe => {
      const outputQty = Number(recipe.OutputQuantity) > 0 ? Number(recipe.OutputQuantity) : 100;
      const yieldLabel = `Batch of ${outputQty} pcs`;

      return {
        recipeId: recipe.RecipeId,
        recipeCode: recipe.RecipeCode,
        recipeName: recipe.RecipeName,
        displayName: `${recipe.RecipeName} — ${yieldLabel}`,
        yieldLabel: yieldLabel,
        productId: recipe.ProductId,
        outputQuantity: outputQty,
        notes: recipe.Notes,
        isActive: recipe.IsActive,
        ingredients: recipe.RecipeIngredients.map(i => ({
          ingredientId: i.IngredientId,
          itemId: i.ItemId,
          uomId: i.UomId,
          standardQuantity: Number(i.StandardQuantity)
        }))
      };
    });

    return resourceResult({ success: true, data: responseData });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function createRecipe(body: RecipeInput) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {

      const product = await tx.finishedProducts.findUnique({
        where: { ProductId: body.productId },
        include: { Items: { include: { Uom: true } } }
      });

      if (!product) return { result: resourceResult({ success: false, message: `Product with ID ${body.productId} not found.` }), audit: undefined };

      if (!body.ingredients || body.ingredients.length === 0) {
        return { result: resourceResult({ success: false, message: "Recipe must have at least one ingredient." }), audit: undefined };
      }

      for (const ing of body.ingredients) {
        if (ing.itemId === product.ItemId) {
          return { result: resourceResult({ success: false, message: "A finished product cannot be an ingredient of its own recipe." }), audit: undefined };
        }
        if (ing.standardQuantity <= 0) {
          return { result: resourceResult({ success: false, message: "Ingredient quantities must be greater than zero." }), audit: undefined };
        }

        const item = await tx.items.findUnique({
          where: { ItemId: ing.itemId },
          include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true, Category: true }
        });
        if (!item) return { result: resourceResult({ success: false, message: `Item with ID ${ing.itemId} not found.` }), audit: undefined };
        const catName = item.Category?.CategoryName?.toLowerCase() || "";
        if (catName.includes("finished good")) {
          return { result: resourceResult({ success: false, message: `'${item.ItemName}' is a finished product and cannot be used as a raw material.` }), audit: undefined };
        }

        if (ing.uomId !== item.StockUomId) {
          const fromUom = await tx.unitOfMeasures.findUnique({ where: { UomId: ing.uomId } });
          const toUom = await tx.unitOfMeasures.findUnique({ where: { UomId: item.StockUomId! } });

          if (!fromUom || !toUom || fromUom.UomType !== toUom.UomType || Number(fromUom.ConversionFactor) <= 0 || Number(toUom.ConversionFactor) <= 0) {
            const abbrev = item.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "an unknown unit";
            const ingAbbrev = fromUom?.Abbreviation || `unit ${ing.uomId}`;
            return { result: resourceResult({ success: false, message: `'${item.ItemName}' is stocked in ${abbrev}, which cannot be converted from ${ingAbbrev}. Choose a unit that measures the same thing.` }), audit: undefined };
          }
        }
      }

      let normalizedName = body.recipeName.trim();
      normalizedName = normalizedName.replace(/\s*(?:[-–—]\s*)?(?:good\s+for\s+)?\d+(?:\.\d+)?\s*(?:pcs?|pieces?|g|kg|grams?|kilograms?|ml|l|liters?|litres?|servings?|containers?)\s*$/i, "");
      normalizedName = normalizedName.replace(/\s+pcs?\s*$/i, "").trim();

      if (!normalizedName) {
        return { result: resourceResult({ success: false, message: "Recipe name must contain the dish or product name, without a yield suffix." }), audit: undefined };
      }

      // Atomic Document Number generation for "Recipe" / BOM
      const year = new Date().getFullYear();
      const seq = await tx.documentSequences.upsert({
        where: { DocType_Year: { DocType: "Recipe", Year: year } },
        update: { LastNumber: { increment: 1 } },
        create: { DocType: "Recipe", Year: year, LastNumber: 1 },
      });
      const recipeCode = `BOM-${year}-${String(seq.LastNumber).padStart(4, '0')}`;

      const outputQty = Number(body.outputQuantity) > 0 ? Number(body.outputQuantity) : 100;

      const newRecipe = await tx.recipes.create({
        data: {
          RecipeCode: recipeCode,
          RecipeName: normalizedName,
          ProductId: body.productId,
          OutputQuantity: outputQty,
          Notes: body.notes || "",
          IsActive: body.isActive ?? true,
          RecipeIngredients: {
            create: body.ingredients.map((i) => ({
              ItemId: i.itemId,
              UomId: i.uomId,
              StandardQuantity: i.standardQuantity,
            }))
          }
        },
        include: {
          RecipeIngredients: {
            include: { Items: true, Uom: true }
          },
          Product: {
            include: { Items: { include: { Uom: true } } }
          }
        }
      });

      const yieldLabel = `Batch of ${outputQty} pcs`;

      const response = {
        recipeId: newRecipe.RecipeId,
        recipeCode: newRecipe.RecipeCode,
        recipeName: newRecipe.RecipeName,
        displayName: `${newRecipe.RecipeName} — ${yieldLabel}`,
        yieldLabel: yieldLabel,
        productId: newRecipe.ProductId,
        outputQuantity: outputQty,
        notes: newRecipe.Notes,
        isActive: newRecipe.IsActive,
        ingredients: newRecipe.RecipeIngredients.map(i => ({
          ingredientId: i.IngredientId,
          itemId: i.ItemId,
          uomId: i.UomId,
          standardQuantity: Number(i.StandardQuantity)
        }))
      };

      const audit = {
        module: "Resources & Suppliers", change: "created",
        target: { type: "recipe", id: newRecipe.RecipeId, name: newRecipe.RecipeName },
        description: `${staff.name} created recipe ${newRecipe.RecipeName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Recipe created successfully", data: response }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error creating recipe:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function getRecipe(idInput: string | number) {
  await requireModule("Resources & Suppliers");

  const rawId = String(idInput);
  const id = Number.parseInt(rawId, 10);

  if (!Number.isInteger(id)) {
    return resourceResult({ success: false, message: "Invalid recipe ID." });
  }

  const recipe = await prisma.recipes.findUnique({
    where: { RecipeId: id },
    include: {
      RecipeIngredients: { include: { Items: true, Uom: true } },
      Product: { include: { Items: { include: { Uom: true } } } },
    },
  });

  if (!recipe) {
    return resourceResult({ success: false, message: `Recipe with ID ${id} not found.` });
  }

  const outputQty = Number(recipe.OutputQuantity) > 0 ? Number(recipe.OutputQuantity) : 100;
  const yieldLabel = `Batch of ${outputQty} pcs`;

  return resourceResult({
    success: true,
    data: {
      recipeId: recipe.RecipeId,
      recipeCode: recipe.RecipeCode,
      recipeName: recipe.RecipeName,
      displayName: `${recipe.RecipeName} — ${yieldLabel}`,
      yieldLabel,
      productId: recipe.ProductId,
      outputQuantity: outputQty,
      notes: recipe.Notes,
      isActive: recipe.IsActive,
      ingredients: recipe.RecipeIngredients.map((ingredient) => ({
        ingredientId: ingredient.IngredientId,
        itemId: ingredient.ItemId,
        itemName: ingredient.Items.ItemName,
        uomId: ingredient.UomId,
        uomName: ingredient.Uom.Abbreviation,
        standardQuantity: Number(ingredient.StandardQuantity),
      })),
    },
  });
}

export async function updateRecipe(idInput: string | number, body: Partial<RecipeInput>) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = parseInt(String(idInput), 10);

      const recipe = await tx.recipes.findUnique({
        where: { RecipeId: id },
        include: {
          RecipeIngredients: true,
          Product: { include: { Items: { include: { Uom: true } } } }
        }
      });

      if (!recipe) return { result: resourceResult({ success: false, message: `Recipe with ID ${id} not found.` }), audit: undefined };

      let normalizedName = recipe.RecipeName;
      if (body.recipeName) {
        normalizedName = body.recipeName.trim();
        normalizedName = normalizedName.replace(/\s*(?:[-–—]\s*)?(?:good\s+for\s+)?\d+(?:\.\d+)?\s*(?:pcs?|pieces?|g|kg|grams?|kilograms?|ml|l|liters?|litres?|servings?|containers?)\s*$/i, "");
        normalizedName = normalizedName.replace(/\s+pcs?\s*$/i, "").trim();

        if (!normalizedName) {
          return { result: resourceResult({ success: false, message: "Recipe name must contain the dish or product name, without a yield suffix." }), audit: undefined };
        }
      }

      if (body.ingredients && Array.isArray(body.ingredients)) {
        for (const ing of body.ingredients) {
          if (ing.itemId === recipe.Product?.ItemId) {
            return { result: resourceResult({ success: false, message: "A finished product cannot be an ingredient of its own recipe." }), audit: undefined };
          }
          if (ing.standardQuantity <= 0) {
            return { result: resourceResult({ success: false, message: "Ingredient quantities must be greater than zero." }), audit: undefined };
          }

          const item = await tx.items.findUnique({
            where: { ItemId: ing.itemId },
            include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true, Category: true }
          });
          if (!item) return { result: resourceResult({ success: false, message: `Ingredient Item with ID ${ing.itemId} does not exist.` }), audit: undefined };
          const catName = item.Category?.CategoryName?.toLowerCase() || "";
          if (catName.includes("finished good")) {
            return { result: resourceResult({ success: false, message: `'${item.ItemName}' is a finished product and cannot be used as a raw material.` }), audit: undefined };
          }

          const uom = await tx.unitOfMeasures.findUnique({ where: { UomId: ing.uomId } });
          if (!uom) return { result: resourceResult({ success: false, message: `Unit of Measure with ID ${ing.uomId} does not exist.` }), audit: undefined };

          if (ing.uomId !== item.StockUomId) {
            const fromUom = uom;
            const toUom = await tx.unitOfMeasures.findUnique({ where: { UomId: item.StockUomId! } });

            if (!fromUom || !toUom || fromUom.UomType !== toUom.UomType || Number(fromUom.ConversionFactor) <= 0 || Number(toUom.ConversionFactor) <= 0) {
              const abbrev = item.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "an unknown unit";
              const ingAbbrev = fromUom?.Abbreviation || `unit ${ing.uomId}`;
              return { result: resourceResult({ success: false, message: `'${item.ItemName}' is stocked in ${abbrev}, which cannot be converted from ${ingAbbrev}. Choose a unit that measures the same thing.` }), audit: undefined };
            }
          }
        }

        // Update Ingredients
        await syncRecipeIngredients(tx, id, recipe.RecipeIngredients, body.ingredients);
      }

      const outputQty = body.outputQuantity !== undefined
        ? (Number(body.outputQuantity) > 0 ? Number(body.outputQuantity) : 100)
        : (Number(recipe.OutputQuantity) > 0 ? Number(recipe.OutputQuantity) : 100);

      const updatedRecipe = await tx.recipes.update({
        where: { RecipeId: id },
        data: {
          RecipeName: normalizedName,
          ProductId: body.productId !== undefined ? Number(body.productId) : undefined,
          Notes: body.notes !== undefined ? body.notes : undefined,
          IsActive: body.isActive !== undefined ? body.isActive : undefined,
          OutputQuantity: outputQty,
        },
        include: {
          RecipeIngredients: { include: { Items: true, Uom: true } },
          Product: { include: { Items: { include: { Uom: true } } } }
        }
      });

      const yieldLabel = `Batch of ${outputQty} pcs`;

      const response = {
        recipeId: updatedRecipe.RecipeId,
        recipeCode: updatedRecipe.RecipeCode,
        recipeName: updatedRecipe.RecipeName,
        displayName: `${updatedRecipe.RecipeName} — ${yieldLabel}`,
        yieldLabel: yieldLabel,
        productId: updatedRecipe.ProductId,
        outputQuantity: outputQty,
        notes: updatedRecipe.Notes,
        isActive: updatedRecipe.IsActive,
        ingredients: updatedRecipe.RecipeIngredients.map(i => ({
          ingredientId: i.IngredientId,
          itemId: i.ItemId,
          uomId: i.UomId,
          standardQuantity: Number(i.StandardQuantity)
        }))
      };

      const audit = {
        module: "Resources & Suppliers", change: "updated",
        target: { type: "recipe", id: updatedRecipe.RecipeId, name: updatedRecipe.RecipeName },
        description: `${staff.name} updated recipe ${updatedRecipe.RecipeName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Recipe updated successfully", data: response }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error updating recipe:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function deleteRecipe(idInput: string | number) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = parseInt(String(idInput), 10);
      const recipe = await tx.recipes.findUnique({
        where: { RecipeId: id },
      });

      if (!recipe) return { result: resourceResult({ success: false, message: `Recipe with ID ${id} not found.` }), audit: undefined };

      // Since RecipeIngredients has a cascade delete in the schema normally, but just to be safe, delete them first.
      await tx.recipeIngredients.deleteMany({ where: { RecipeId: id } });
      await tx.recipes.delete({ where: { RecipeId: id } });

      const audit = {
        module: "Resources & Suppliers", change: "deleted",
        target: { type: "recipe", id: recipe.RecipeId, name: recipe.RecipeName },
        description: `${staff.name} deleted recipe ${recipe.RecipeName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Recipe deleted successfully" }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function nextRecipeCode() {
  await requireModule("Resources & Suppliers");

  try {
    const year = new Date().getFullYear();
    const seq = await prisma.documentSequences.findUnique({
      where: { DocType_Year: { DocType: "Recipe", Year: year } },
    });

    const nextNumber = (seq?.LastNumber ?? 0) + 1;
    const nextCode = `BOM-${year}-${String(nextNumber).padStart(4, "0")}`;

    return resourceResult({ success: true, nextCode });
  } catch (error) {
    console.error("Error generating next recipe code:", error);
    const fallbackYear = new Date().getFullYear();
    return resourceResult({ success: true, nextCode: `BOM-${fallbackYear}-0001` });
  }
}
