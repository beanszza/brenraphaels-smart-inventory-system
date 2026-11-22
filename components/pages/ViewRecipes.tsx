"use client";

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  saveRecipe,
  type RecipeInput,
} from "@/lib/resources-suppliers/actions";
import type { ResourcesData } from "@/lib/resources-suppliers/data";
import { Recipe } from "@/components/resources-suppliers/types";
import RecipeTab from "@/components/resources-suppliers/RecipeTab";
import RecipeFormPage from "@/components/resources-suppliers/RecipeFormPage";

export default function ViewRecipes({ data }: { data: ResourcesData }) {
  const router = useRouter();
  const {
    supplies: supplyData,
    recipes: recipeData,
    products: finishedProductData,
    categories: supplyCategories,
    allCategories: categoryData = [],
  } = data;

  const activeSupplyCategories = useMemo(() => {
    if (categoryData.length > 0) {
      return categoryData
        .filter((c) => c.isActive !== false)
        .map((c) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          hasExpiry: c.hasExpiry,
        }));
    }
    return supplyCategories;
  }, [categoryData, supplyCategories]);

  const [recipeFilter, setRecipeFilter] = useState("All");
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipePage, setRecipePage] = useState(1);

  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const handleSaveRecipe = async (input: RecipeInput) => {
    const result = await saveRecipe(input, editingRecipe?.recipeId);
    if (!result.success) throw new Error(result.message);
    toast.success(result.message);
    setViewMode("list");
    setEditingRecipe(null);
    setRecipePage(1);
    router.refresh();
  };

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      {viewMode === "form" ? (
        <RecipeFormPage
          key={editingRecipe?.recipeId ?? "new"}
          editingRecipe={editingRecipe}
          finishedProducts={finishedProductData}
          baseSupplies={supplyData}
          categories={activeSupplyCategories}
          onCancel={() => {
            setViewMode("list");
            setEditingRecipe(null);
          }}
          onSave={handleSaveRecipe}
        />
      ) : (
        <RecipeTab
          recipes={recipeData}
          searchQuery={recipeSearchQuery}
          onSearchChange={setRecipeSearchQuery}
          statusFilter={recipeFilter}
          onStatusFilterChange={setRecipeFilter}
          currentPage={recipePage}
          onPageChange={setRecipePage}
          isAuthorizedForReports={true}
          onAddNew={() => {
            setEditingRecipe(null);
            setViewMode("form");
          }}
          onEdit={(r) => {
            setEditingRecipe(r);
            setViewMode("form");
          }}
        />
      )}
    </div>
  );
}
