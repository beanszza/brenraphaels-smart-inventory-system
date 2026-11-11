"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import Pagination from "@/components/Pagination";
import { CategoryItem } from "./types";
import CategoryTable from "./CategoryTable";
import ResourceStatusTabs from "./ResourceStatusTabs";

interface CategoryTabProps {
  categories: CategoryItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  canConfigure?: boolean;
  onAddNew: () => void;
  onEdit: (item: CategoryItem) => void;
}

export default function CategoryTab({
  categories,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  onPageChange,
  canConfigure = true,
  onAddNew,
  onEdit,
}: CategoryTabProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const statusCounts = {
    all: categories.length,
    active: categories.filter((c) => c.isActive !== false).length,
    inactive: categories.filter((c) => c.isActive === false).length,
  };

  const filteredCategories = categories.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.categoryName.toLowerCase().includes(q) ||
      item.categoryId.toString().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && item.isActive !== false) ||
      (statusFilter === "Inactive" && item.isActive === false);
    return matchesSearch && matchesStatus;
  });

  const pageSize = 10;
  const totalCount = filteredCategories.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 animate-page-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supply Categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage classification categories for supplies and inventory tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {canConfigure && (
            <Button
              type="button"
              onClick={onAddNew}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10"
            >
              <Plus className="w-4 h-4" /> Add New Category
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-3">
        <SearchInput
          placeholder="Search category name or description..."
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

      <CategoryTable
        items={paginatedCategories}
        currentPage={currentPage}
        pageSize={pageSize}
        canConfigure={canConfigure}
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
