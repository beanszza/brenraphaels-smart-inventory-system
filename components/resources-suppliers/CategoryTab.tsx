"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, RefreshCw } from "lucide-react";
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
          <Button
            type="button"
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" /> Add New Category
          </Button>
        </div>
      </div>

      <div className="mb-6 border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search category name or description..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-sm flex-1 text-foreground placeholder:text-muted-foreground"
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

      <CategoryTable
        items={paginatedCategories}
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
