"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, FileText } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { Supplier } from "./types";
import SupplierTable from "./SupplierTable";
import ResourceStatusTabs from "./ResourceStatusTabs";

interface SupplierTabProps {
  suppliers: Supplier[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  isAuthorizedForReports: boolean;
  onAddNew: () => void;
  onEdit: (supplier: Supplier) => void;
  onView: (supplier: Supplier) => void;
}

export default function SupplierTab({
  suppliers,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  currentPage,
  onPageChange,
  isAuthorizedForReports,
  onAddNew,
  onEdit,
  onView,
}: SupplierTabProps) {
  const statusCounts = {
    all: suppliers.length,
    active: suppliers.filter((supplier) => supplier.isActive).length,
    inactive: suppliers.filter((supplier) => !supplier.isActive).length,
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (supplier.supplierCode ? supplier.supplierCode.toLowerCase().includes(q) : false) ||
      supplier.supplierId.toString().includes(q) ||
      supplier.companyName.toLowerCase().includes(q) ||
      supplier.contactPerson.toLowerCase().includes(q) ||
      supplier.email.toLowerCase().includes(q) ||
      supplier.phone.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && supplier.isActive) ||
      (statusFilter === "Inactive" && !supplier.isActive);
    return matchesSearch && matchesStatus;
  });

  const pageSize = 10;
  const totalCount = filteredSuppliers.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supplier Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">Partner directories and statuses</p>
        </div>
        <div className="flex items-center gap-3">
          {isAuthorizedForReports && (
            <Link
              href="/reports?tab=supplier"
              className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <FileText size={16} /> Reports
            </Link>
          )}
          <Button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm"
          >
            <Plus size={16} /> Add Supplier
          </Button>
        </div>
      </div>

      <div className="mb-6 border border-border rounded-md overflow-hidden bg-card">
        <div className="flex items-center justify-between gap-sm px-md py-sm bg-muted/20">
          <div className="flex items-center gap-sm flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by Supplier No, company, contact, or email..."
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

      <SupplierTable
        suppliers={paginatedSuppliers}
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
