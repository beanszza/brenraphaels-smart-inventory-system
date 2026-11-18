"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { Recipe } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface RecipeTableProps {
  recipes: Recipe[];
  currentPage: number;
  pageSize: number;
  onEdit: (recipe: Recipe) => void;
}

export default function RecipeTable({ recipes, currentPage, pageSize, onEdit }: RecipeTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full min-w-[700px]">
        <thead className="border-b border-divider bg-surface-muted table-head-row">
          <tr className="text-left type-table-header uppercase text-text-muted">
            <th className="sticky left-0 z-20 w-16 px-4 py-3.5 table-th bg-surface-muted border-r border-divider shadow-sticky-col">No.</th>
            <th className="table-th px-4 py-3.5 min-w-[200px]">Recipe Name</th>
            <th className="table-th px-4 py-3.5">Finished Product</th>
            <th className="table-th px-4 py-3.5">Batch Size</th>
            <th className="table-th px-4 py-3.5">Status</th>
            <th className="table-th px-4 py-3.5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {recipes.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center type-body text-text-muted">
                No recipes found.
              </td>
            </tr>
          ) : (
            recipes.map((recipe, index) => (
              <tr key={recipe.recipeId} className="table-row hover:bg-hover transition-colors group">
                <td className="sticky left-0 z-10 w-16 px-4 py-3 table-td text-text-muted whitespace-nowrap bg-surface group-hover:bg-hover transition-colors border-r border-divider shadow-sticky-col">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="table-td px-4 py-3 font-semibold text-text-primary min-w-[200px]">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span
                        className="cursor-default whitespace-nowrap"
                        title={recipe.recipeCode ? `Recipe No: ${recipe.recipeCode}` : undefined}
                      >
                        {recipe.recipeName}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72">
                      <div className="space-y-1.5">
                        <p className="type-caption font-semibold text-text-primary">{recipe.recipeName}</p>
                        {recipe.recipeCode && (
                          <p className="type-caption font-mono text-text-muted">No: {recipe.recipeCode}</p>
                        )}
                        {recipe.finishedProduct && (
                          <p className="type-caption text-text-muted">Product: {recipe.finishedProduct}</p>
                        )}
                        <p className="type-caption text-text-muted">
                          Batch Size: {recipe.outputQuantity ? `${recipe.outputQuantity} pcs` : recipe.yieldLabel || "100 pcs"}
                        </p>
                        {recipe.notes && (
                          <p className="type-caption text-text-muted">Notes: {recipe.notes}</p>
                        )}
                        <div className="pt-1">
                          <StatusBadge status={recipe.isActive ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="table-td px-4 py-3 text-text-muted">{recipe.finishedProduct || "N/A"}</td>
                <td className="table-td px-4 py-3 text-text-muted">
                  {recipe.outputQuantity ? `${recipe.outputQuantity} pcs` : recipe.yieldLabel || "100 pcs"}
                </td>
                <td className="table-td px-4 py-3">
                  <StatusBadge status={recipe.isActive ? "Active" : "Inactive"} />
                </td>
                <td className="table-td px-4 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdownId(activeDropdownId === recipe.recipeId ? null : recipe.recipeId)
                    }
                    aria-label="Record actions" className="p-1.5 rounded-control text-text-primary hover:bg-hover transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === recipe.recipeId && (
                    <div className="absolute right-10 top-2 z-[100] w-32 rounded-menu border border-divider bg-surface shadow-menu py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(recipe);
                          setActiveDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-hover transition-colors"
                      >
                        <Pencil size={14} className="shrink-0" /> Edit Recipe
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
