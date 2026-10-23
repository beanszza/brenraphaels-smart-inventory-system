"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, FileText } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { Recipe } from "./types";

import RecipeTable from "./RecipeTable";
import ResourceStatusTabs from "./ResourceStatusTabs";

interface RecipeTabProps {
  recipes: Recipe[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  isAuthorizedForReports: boolean;
  onAddNew: () => void;
  onEdit: (recipe: Recipe) => void;
}

export default function RecipeTab({
  recipes,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  onPageChange,
  isAuthorizedForReports,
  onAddNew,
  onEdit,
}: RecipeTabProps) {
  const statusCounts = {
    all: recipes.length,
    active: recipes.filter((recipe) => recipe.isActive).length,
    inactive: recipes.filter((recipe) => !recipe.isActive).length,
  };

  const filteredRecipes = recipes.filter((recipe) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      recipe.recipeName.toLowerCase().includes(q) ||
      (recipe.recipeCode ? recipe.recipeCode.toLowerCase().includes(q) : false) ||
      (recipe.finishedProduct ? recipe.finishedProduct.toLowerCase().includes(q) : false) ||
      recipe.recipeId.toString().includes(q);
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && recipe.isActive) ||
      (statusFilter === "Inactive" && !recipe.isActive);
    return matchesSearch && matchesStatus;
  });

  const pageSize = 10;
  const totalCount = filteredRecipes.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedRecipes = filteredRecipes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recipe Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">Production recipes and ingredients breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAuthorizedForReports && (
            <Link
              href="/resources-suppliers/logs?type=Recipe"
              className="flex items-center justify-center gap-2 rounded-lg bg-card border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <FileText size={16} /> Transaction History
            </Link>
          )}
          <Button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors "
          >
            <Plus size={16} /> New Recipe
          </Button>
        </div>
      </div>

      <div className="mb-6 border border-border rounded-md overflow-hidden bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by Recipe No, recipe, or product name..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-body-sm flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <ResourceStatusTabs
        value={statusFilter}
        counts={statusCounts}
        onChange={(status) => {
          onStatusFilterChange(status);
          onPageChange(1);
        }}
      />

      <RecipeTable
        recipes={paginatedRecipes}
        currentPage={currentPage}
        pageSize={pageSize}
        onEdit={onEdit}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={onPageChange}
      />
    </div>
  );
}
