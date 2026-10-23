"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, RefreshCw, Boxes, Clock, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import PutAwayTable from "./PutAwayTable";
import CompletePutAwayModal from "./CompletePutAwayModal";
import Pagination from "@/components/Pagination";
import { PutAwayTask } from "./types";

type PutAwaySubTab = "pending" | "completed" | "all";

export default function PutAwayTab() {
  const [tasks, setTasks] = useState<PutAwayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [activeSubTab, setActiveSubTab] = useState<PutAwaySubTab>("pending");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedTask, setSelectedTask] = useState<PutAwayTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/PutAway");
      if (res.data?.success) {
        setTasks(res.data.data || []);
      }
    } catch (err: any) {
      console.error("Error fetching Put Away tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Counts
  const counts = useMemo(() => {
    let pending = 0;
    let completed = 0;

    tasks.forEach((t) => {
      if (t.status === "Pending") pending++;
      else if (t.status === "Completed") completed++;
    });

    return {
      pending,
      completed,
      all: tasks.length,
    };
  }, [tasks]);

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.supplierName) set.add(t.supplierName);
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Filtered by subtab, search, and supplier
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Subtab filter
      if (activeSubTab === "pending" && t.status !== "Pending") return false;
      if (activeSubTab === "completed" && t.status !== "Completed") return false;

      // Supplier filter
      if (supplierFilter !== "All" && t.supplierName !== supplierFilter) return false;

      // Search filter
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          t.putAwayNumber?.toLowerCase().includes(s) ||
          t.grnNumber?.toLowerCase().includes(s) ||
          t.poNumber?.toLowerCase().includes(s) ||
          t.prNumber?.toLowerCase().includes(s) ||
          t.supplierName?.toLowerCase().includes(s) ||
          t.itemName?.toLowerCase().includes(s) ||
          t.lotCode?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [tasks, activeSubTab, search, supplierFilter]);

  // Paginated list
  const totalCount = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  const handleSelectTask = (task: PutAwayTask) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleStartPutAway = () => {
    const pending = tasks.filter((t) => t.status === "Pending");
    if (pending.length > 0) {
      setSelectedTask(pending[0]);
      setModalOpen(true);
    } else {
      alert("No pending put-away tasks. Incoming lots from Quality Assurance inspections will appear here.");
    }
  };

  const tabs = [
    { id: "pending" as PutAwaySubTab, label: "Pending Put Away", count: counts.pending },
    { id: "completed" as PutAwaySubTab, label: "Completed Put Away", count: counts.completed },
    { id: "all" as PutAwaySubTab, label: "All Tasks", count: counts.all },
  ];

  return (
    <div className="space-y-6 animate-page-in">
      {/* Top Header Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Inventory Put Away & Stock Release</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Move QA-passed goods into commissary storage to immediately release items for production and POS sales
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTasks}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            type="button"
            onClick={handleStartPutAway}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10"
          >
            <Boxes className="w-4 h-4" /> Start Put Away
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center border border-border rounded-md bg-card px-2 py-2">
        <div className="flex flex-1 items-center gap-2 px-2 bg-muted/20 h-full rounded-md">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Search by task, Goods Receipt Note, Purchase Order, Purchase Requisition, item, or lot..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-xs flex-1 text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium pr-2"
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
              <SelectTrigger className="h-10 w-[180px] rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent align="end" className="text-xs z-[9999]">
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

      {/* Subtab Pill Navigation */}
      <div className="border-b border-border overflow-x-auto">
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-background text-foreground" : "bg-foreground/20 text-foreground"
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
      <PutAwayTable tasks={paginatedList} loading={loading} onSelectTask={handleSelectTask} />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Complete Put Away Modal */}
      <CompletePutAwayModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
        }}
      />
    </div>
  );
}
