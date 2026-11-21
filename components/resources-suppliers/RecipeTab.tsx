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
    <div className="space-y-5 animate-page-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Bill of Materials</h2>
          <p className="mt-1 type-body text-ink-muted">Production recipes, batch yields, and ingredient breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
            >
              <Link href="/resources-suppliers/logs">
                <FileText className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}
          <Button
            type="button"
            onClick={onAddNew}
            className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none"
          >
            <Plus className="w-4 h-4" /> Create Bill of Materials
          </Button>
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

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search recipe or product name..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
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
          embedded
        />
      </div>
    </div>
  );
}
