"use client";

import React from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { Recipe } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RecipeTableProps {
  recipes: Recipe[];
  currentPage: number;
  pageSize: number;
  onEdit: (recipe: Recipe) => void;
}

export default function RecipeTable({ recipes, currentPage, pageSize, onEdit }: RecipeTableProps) {

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="w-12 pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[200px]">Recipe Name</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Finished Product</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Batch Size</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {recipes.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 text-center type-body text-ink-muted">
                No recipes found.
              </td>
            </tr>
          ) : (
            recipes.map((recipe, index) => (
              <tr key={recipe.recipeId} className="hover:bg-page transition-colors group">
                <td className="w-12 py-3 pr-4 type-body text-ink-muted whitespace-nowrap tabular-nums">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap min-w-[200px]">
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
                        <p className="type-caption font-semibold text-ink">{recipe.recipeName}</p>
                        {recipe.recipeCode && (
                          <p className="type-caption font-mono text-ink-muted">No: {recipe.recipeCode}</p>
                        )}
                        {recipe.finishedProduct && (
                          <p className="type-caption text-ink-muted">Product: {recipe.finishedProduct}</p>
                        )}
                        <p className="type-caption text-ink-muted">
                          Batch Size: {recipe.outputQuantity ? `${recipe.outputQuantity} pcs` : recipe.yieldLabel || "100 pcs"}
                        </p>
                        {recipe.notes && (
                          <p className="type-caption text-ink-muted">Notes: {recipe.notes}</p>
                        )}
                        <div className="pt-1">
                          <StatusBadge status={recipe.isActive ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="py-3 pr-4 type-body text-ink">{recipe.finishedProduct || "N/A"}</td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                  {recipe.outputQuantity ? `${recipe.outputQuantity} pcs` : recipe.yieldLabel || "100 pcs"}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <StatusBadge status={recipe.isActive ? "Active" : "Inactive"} />
                </td>
                <td className="w-16 py-3 pl-4 text-center whitespace-nowrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Record actions"
                        className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={() => onEdit(recipe)}
                        className="cursor-pointer type-body-secondary"
                      >
                        <Pencil size={14} className="shrink-0" /> Edit Recipe
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
