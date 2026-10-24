"use server";
import * as recipes from "@/lib/resources/recipes";
import type { RecipeInput } from "@/lib/resources/inputs";
export async function listRecipes() { return recipes.listRecipes("Production & Quality"); }
export async function createRecipe(body: RecipeInput) { return recipes.createRecipe("Production & Quality", body); }
export async function getRecipe(id: string | number) { return recipes.getRecipe("Production & Quality", id); }
export async function updateRecipe(id: string | number, body: Partial<RecipeInput>) { return recipes.updateRecipe("Production & Quality", id, body); }
export async function deleteRecipe(id: string | number) { return recipes.deleteRecipe("Production & Quality", id); }
export async function nextRecipeCode() { return recipes.nextRecipeCode("Production & Quality"); }
