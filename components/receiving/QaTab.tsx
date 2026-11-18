"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import QaTable from "./QaTable";
import QaInspectionModal from "./QaInspectionModal";
import AddQaModal from "./AddQaModal";
import Pagination from "@/components/Pagination";
import { QAInspection } from "./types";

type QaSubTab = "all" | "ready_to_qa" | "completed_qa";

export default function QaTab() {
  const [inspections, setInspections] = useState<QAInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [activeSubTab, setActiveSubTab] = useState<QaSubTab>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Inspection modal (view/complete an existing inspection)
  const [selectedInspection, setSelectedInspection] = useState<QAInspection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Add QA modal (select a GRN to start)
  const [addQaOpen, setAddQaOpen] = useState(false);

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await receiving.listInspections();
      if (res.data?.success) {
        setInspections(res.data.data || []);
      }
    } catch (err: unknown) {
      console.error("Error fetching QA inspections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  // Tab counts
  const counts = useMemo(() => {
    let ready = 0;
    let completed = 0;

    inspections.forEach((q) => {
      const st = q.status;
      if (st === "Pending" || st === "InInspection" || st === "InProgress" || st === "In Inspection") {
        ready++;
      } else {
        completed++; // Passed, PassedWithConcession, Failed
      }
    });

    return {
      all: inspections.length,
      ready_to_qa: ready,
      completed_qa: completed,
    };
  }, [inspections]);

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach((q) => {
      if (q.supplierName) set.add(q.supplierName);
    });
    return Array.from(set).sort();
  }, [inspections]);

  // Filtered by subtab, search, and supplier
  const filteredInspections = useMemo(() => {
    return inspections.filter((qc) => {
      // Subtab filter
      const isPending =
        qc.status === "Pending" ||
        qc.status === "InInspection" ||
        qc.status === "InProgress" ||
        qc.status === "In Inspection";

      if (activeSubTab === "ready_to_qa" && !isPending) return false;
      if (activeSubTab === "completed_qa" && isPending) return false;

      // Supplier Filter
      if (supplierFilter !== "All" && qc.supplierName !== supplierFilter) return false;

      // Search filter
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          qc.inspectionNumber?.toLowerCase().includes(s) ||
          qc.referenceNumber?.toLowerCase().includes(s) ||
          qc.grnNumber?.toLowerCase().includes(s) ||
          qc.poNumber?.toLowerCase().includes(s) ||
          qc.prNumber?.toLowerCase().includes(s) ||
          qc.supplierName?.toLowerCase().includes(s) ||
          qc.inspectorName?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [inspections, activeSubTab, search, supplierFilter]);

  // Paginated list
  const totalCount = filteredInspections.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInspections.slice(start, start + pageSize);
  }, [filteredInspections, page, pageSize]);

  const handleSelectInspection = (qc: QAInspection) => {
    setSelectedInspection(qc);
    setModalOpen(true);
  };

  // Called by AddQaModal when user selects a GRN and the inspection is found
  const handleStartInspection = (inspection: QAInspection) => {
    setSelectedInspection(inspection);
    setModalOpen(true);
  };

  const tabs = [
    { id: "all" as QaSubTab, label: "All", count: counts.all },
    { id: "ready_to_qa" as QaSubTab, label: "Ready for Quality Assurance", count: counts.ready_to_qa },
    { id: "completed_qa" as QaSubTab, label: "Completed Quality Assurance", count: counts.completed_qa },
  ];

  return (
    <div className="space-y-6 animate-page-in">
      {/* Top Header Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-text-primary">Incoming Quality Assurance</h2>
          <p className="mt-1 type-body text-text-muted">
            Evaluate delivered materials against specifications, record lot dispositions, and trigger automated quarantine or put-away
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInspections}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-table-header text-text-primary hover:bg-surface-hover transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            type="button"
            onClick={() => setAddQaOpen(true)}
            className="flex items-center justify-center gap-2 rounded-control bg-button-primary px-5 py-2.5 type-label-button text-text-inverse hover:bg-button-primary-hover transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" /> Add Quality Assurance
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center rounded-card border border-divider bg-surface p-3">
        <div className="flex flex-1 items-center gap-2">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by inspection, Goods Receipt Note, Purchase Order, Purchase Requisition, or supplier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="type-caption text-text-muted hover:text-text-primary font-medium px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Select
              value={supplierFilter}
              onValueChange={(val) => {
                setSupplierFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-[180px] rounded-control border border-divider bg-surface px-3 type-body text-text-primary shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent align="end" className="type-body bg-surface border-divider z-[9999]">
                <SelectItem value="All">All Suppliers</SelectItem>
                {uniqueSuppliers.map((supp) => (
                  <SelectItem key={supp} value={supp}>
                    {supp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Subtab Pill Navigation: All, Ready to Quality Assurance, Completed Quality Assurance */}
      <div className="border-b border-divider overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-2">
          {tabs.map((t) => {
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveSubTab(t.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-button-primary text-text-inverse shadow-sm"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-pill type-caption font-mono font-medium ${
                      isActive ? "bg-surface text-text-primary" : "bg-surface-muted text-text-muted"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <QaTable
        inspections={paginatedList}
        loading={loading}
        onSelectInspection={handleSelectInspection}
        pendingView={activeSubTab === "ready_to_qa"}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Add Quality Assurance Modal — user selects a GRN */}
      <AddQaModal
        open={addQaOpen}
        onClose={() => setAddQaOpen(false)}
        onStartInspection={handleStartInspection}
      />

      {/* Inspection Modal — view/complete a specific inspection */}
      <QaInspectionModal
        inspection={selectedInspection}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          fetchInspections();
        }}
      />
    </div>
  );
}
