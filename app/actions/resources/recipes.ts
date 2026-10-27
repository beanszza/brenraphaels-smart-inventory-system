"use server";
import * as recipes from "@/lib/resources/recipes";
import type { RecipeInput } from "@/lib/resources/inputs";
export async function listRecipes() { return recipes.listRecipes("Resources & Suppliers"); }
export async function createRecipe(body: RecipeInput) { return recipes.createRecipe("Resources & Suppliers", body); }
export async function getRecipe(id: string | number) { return recipes.getRecipe("Resources & Suppliers", id); }
export async function updateRecipe(id: string | number, body: Partial<RecipeInput>) { return recipes.updateRecipe("Resources & Suppliers", id, body); }
export async function deleteRecipe(id: string | number) { return recipes.deleteRecipe("Resources & Suppliers", id); }
export async function nextRecipeCode() { return recipes.nextRecipeCode("Resources & Suppliers"); }
