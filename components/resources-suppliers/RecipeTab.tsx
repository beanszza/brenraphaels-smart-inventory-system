"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, FileText, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
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
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

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
    <div className="space-y-6 animate-page-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bill of Materials</h2>
          <p className="mt-1 text-sm text-muted-foreground">Production recipes, batch yields, and ingredient breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isAuthorizedForReports && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
            >
              <Link href="/resources-suppliers/logs?type=Recipe">
                <FileText className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}
          <Button
            type="button"
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" /> Create Bill of Materials
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-3">
        <SearchInput
          placeholder="Search by Recipe No, recipe, or product name..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
        />
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
