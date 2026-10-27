"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, FileText } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
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
  onAddNew,
  onEdit,
  onView,
}: SupplyTabProps) {
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
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Supply List</h2>
          <p className="mt-1 text-sm text-muted-foreground">Raw materials, ingredients, and tools inventory</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAuthorizedForReports && (
            <Link
              href="/resources-suppliers/logs?type=Supply"
              className="flex items-center justify-center gap-2 rounded-lg bg-card border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <FileText size={16} /> Transaction History
            </Link>
          )}
          <Button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors "
          >
            <Plus size={16} /> Add New Supply
          </Button>
        </div>
      </div>

      <div className="mb-6 border border-border rounded-md overflow-hidden bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by name or Supply No (e.g. SPL-0001)..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-body-sm flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                onCategoryFilterChange(val);
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[210px] w-auto rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground  focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="min-w-[210px]">
                <SelectItem value="All">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.categoryId} value={c.categoryName}>
                    {c.categoryName === "Tools and Supplies" ? "Tools & Supplies" : c.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <SupplyTable
        items={paginatedSupplies}
        currentPage={currentPage}
        pageSize={pageSize}
        onEdit={onEdit}
        onView={onView}
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
