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
    <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[700px]">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="sticky left-0 z-20 w-16 px-4 py-3.5 bg-muted/95 backdrop-blur-xs">No.</th>
            <th className="sticky left-[64px] z-20 min-w-[200px] w-52 px-4 py-3.5 border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] bg-muted/95 backdrop-blur-xs">Recipe Name</th>
            <th className="px-4 py-3.5">Finished Product</th>
            <th className="px-4 py-3.5">Batch Size</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {recipes.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-sm font-normal text-muted-foreground">
                No recipes found.
              </td>
            </tr>
          ) : (
            recipes.map((recipe, index) => (
              <tr key={recipe.recipeId} className="hover:bg-muted/20 transition-colors group">
                <td className="sticky left-0 z-10 w-16 px-4 py-3 text-sm text-muted-foreground whitespace-nowrap bg-card group-hover:bg-muted/40 transition-colors">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="sticky left-[64px] z-10 min-w-[200px] w-52 px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] bg-card group-hover:bg-muted/40 transition-colors">
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
                        <p className="text-xs font-bold text-foreground">{recipe.recipeName}</p>
                        {recipe.recipeCode && (
                          <p className="text-xs font-mono text-muted-foreground">No: {recipe.recipeCode}</p>
                        )}
                        {recipe.finishedProduct && (
                          <p className="text-xs text-muted-foreground">Product: {recipe.finishedProduct}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Batch Size: {recipe.outputQuantity ? `${recipe.outputQuantity} pcs` : recipe.yieldLabel || "100 pcs"}
                        </p>
                        {recipe.notes && (
                          <p className="text-xs text-muted-foreground">Notes: {recipe.notes}</p>
                        )}
                        <div className="pt-1">
                          <StatusBadge status={recipe.isActive ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{recipe.finishedProduct || "N/A"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {recipe.outputQuantity ? `${recipe.outputQuantity} pcs` : recipe.yieldLabel || "100 pcs"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={recipe.isActive ? "Active" : "Inactive"} />
                </td>
                <td className="px-4 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdownId(activeDropdownId === recipe.recipeId ? null : recipe.recipeId)
                    }
                    aria-label="Record actions" className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === recipe.recipeId && (
                    <div className="absolute right-10 top-2 z-[100] w-32 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(recipe);
                          setActiveDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
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
