"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useIsAdmin } from "@/context/StaffContext";
import { SupplyItem } from "./types";
import SupplyTable from "./SupplyTable";
import ResourceStatusTabs from "./ResourceStatusTabs";

interface SupplyTabProps {
  supplies: SupplyItem[];
  categories?: { categoryId: number; categoryName: string }[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  isAuthorizedForReports: boolean;
  canConfigure?: boolean;
  onAddNew: () => void;
  onEdit: (item: SupplyItem) => void;
  onView?: (item: SupplyItem) => void;
}

export default function SupplyTab({
  supplies,
  categories = [],
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  onPageChange,
  isAuthorizedForReports,
  canConfigure = true,
  onAddNew,
  onEdit,
  onView,
}: SupplyTabProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const statusCounts = {
    all: supplies.length,
    active: supplies.filter((item) => item.isActive !== false).length,
    inactive: supplies.filter((item) => item.isActive === false).length,
  };

  const filteredSupplies = supplies.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.itemName.toLowerCase().includes(q) ||
      (item.itemCode ? item.itemCode.toLowerCase().includes(q) : false) ||
      item.itemId.toString().includes(q);
    const matchesCategory = categoryFilter === "All" || item.categoryName === categoryFilter;
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && item.isActive !== false) ||
      (statusFilter === "Inactive" && item.isActive === false);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const pageSize = 10;
  const totalCount = filteredSupplies.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedSupplies = filteredSupplies.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5 animate-page-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Supply List</h2>
          <p className="mt-1 type-body text-ink-muted">Raw materials, ingredients, and tools inventory</p>
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
          {canConfigure && (
            <Button
              type="button"
              onClick={onAddNew}
              className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none"
            >
              <Plus className="w-4 h-4" /> Add New Supply
            </Button>
          )}
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
        <Select
          value={categoryFilter}
          onValueChange={(val) => {
            onCategoryFilterChange(val);
            onPageChange(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Category:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Categories" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            className="min-w-[230px] max-h-72"
          >
            <SelectItem value="All">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.categoryId} value={c.categoryName}>
                {c.categoryName === "Tools and Supplies" ? "Tools & Supplies" : c.categoryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search supply name or code..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <SupplyTable
          items={paginatedSupplies}
          currentPage={currentPage}
          pageSize={pageSize}
          canConfigure={canConfigure}
          onEdit={onEdit}
          onView={onView}
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
