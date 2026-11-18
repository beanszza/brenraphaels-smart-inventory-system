"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, FileText } from "lucide-react";
import { useIsAdmin } from "@/context/StaffContext";
import { SearchInput } from "@/components/shared/SearchInput";
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
  canConfigure?: boolean;
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
  canConfigure = true,
  onAddNew,
  onEdit,
  onView,
}: SupplierTabProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

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
    <div className="space-y-6 animate-page-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Supplier Management</h2>
          <p className="mt-1 type-body text-ink-muted">Partner directories, verified contacts, and statuses</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 rounded-control bg-surface border border-border px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="flex items-center justify-center gap-2 rounded-control bg-surface border border-border px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
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
              className="flex items-center justify-center gap-2 rounded-control bg-primary px-5 py-2.5 type-label-button text-primary-foreground hover:bg-primary-hover transition-colors shadow-xs h-10"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-card border border-border bg-surface p-3">
        <SearchInput
          placeholder="Search by Supplier No, company, contact, or email..."
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

      <SupplierTable
        suppliers={paginatedSuppliers}
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
      />
    </div>
  );
}
