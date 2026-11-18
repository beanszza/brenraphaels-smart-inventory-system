"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, FileText, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useIsAdmin } from "@/context/StaffContext";
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
  const isAdmin = useIsAdmin();
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
          <h2 className="type-page-title text-text-primary">Bill of Materials</h2>
          <p className="mt-1 type-body text-text-muted">Production recipes, batch yields, and ingredient breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-label-button text-text-primary hover:bg-hover transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-label-button text-text-primary hover:bg-hover transition-colors h-10 cursor-pointer"
            >
              <Link href="/resources-suppliers/logs">
                <FileText className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}
          <Button
            type="button"
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 rounded-control bg-button-primary px-5 py-2.5 type-label-button text-button-primary-foreground hover:bg-button-primary-hover transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" /> Create Bill of Materials
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-card border border-divider bg-surface p-3 shadow-card">
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
