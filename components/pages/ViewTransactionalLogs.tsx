"use client";

import React, { useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import AuditLogsFilterBar from "@/components/pages/AuditLogsFilterBar";
import AuditLogsTable, { LogEntry } from "@/components/pages/AuditLogsTable";
import { downloadAuditLogsPdf } from "@/components/pages/downloadAuditLogsPdf";

const parseLogTime = (ts: string): number => {
  if (!ts) return 0;
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d.getTime();
  const [datePart, timePart = "00:00:00"] = ts.split(" ");
  if (datePart && datePart.includes("/")) {
    const [m, dNum, y] = datePart.split("/").map(Number);
    const [h, min, s] = timePart.split(":").map(Number);
    return new Date(y, (m || 1) - 1, dNum || 1, h || 0, min || 0, s || 0).getTime();
  }
  return 0;
};

export default function ViewTransactionalLogs({
  initialLogs,
  unavailable = false,
  entityOptions,
  moduleTitle,
}: {
  initialLogs: LogEntry[];
  unavailable?: boolean;
  entityOptions?: string[];
  moduleTitle?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams?.get("type") || "Supply";
  const logs = initialLogs;
  const formattedType = typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase();
  const title = moduleTitle ? `${moduleTitle} Transactional History` : `${formattedType} Transactional Audit Logs`;

  const [entityFilter, setEntityFilter] = useState<string>("All");
  const [filterMode, setFilterMode] = useState<"all" | "specific" | "range">("all");
  const [specificDate, setSpecificDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const subtitle = useMemo(() => {
    switch (moduleTitle) {
      case "Resources & Suppliers":
        return "Audit trail for Categories, Suppliers, Supplies, and Recipe/BOM modifications";
      case "Inventory":
        return "Audit trail for Stock Adjustments, Cycle Counts, and Stock Write-Offs";
      case "Goods Receiving":
        return "Audit trail for Goods Receipt Notes, Stock-Ins, Discrepancies, Returns, and Loss Reports";
      case "Stock Transfer":
        return "Audit trail for Transfer Requests, Scheduling, Dispatches, and Locations";
      case "Orders & Procurement":
        return "Audit trail for Purchase Requisitions, Purchase Orders, and Delivery Orders";
      case "Production & Quality":
        return "Audit trail for Production Requests, Material Issuances, Batch Tracking, and QA Inspections";
      default:
        return "Chronological audit trail of transactional changes, approvals, and system events";
    }
  }, [moduleTitle]);

  const handleResetFilters = () => {
    setEntityFilter("All"); setFilterMode("all"); setSpecificDate(""); setStartDate(""); setEndDate(""); setSearchQuery(""); setCurrentPage(1);
  };

  const filteredLogs = logs.filter((log) => {
    if (entityFilter && entityFilter !== "All") {
      const lowerAct = log.activity.toLowerCase();
      const lowerEnt = log.entityName.toLowerCase();
      if (entityFilter === "Categories" && !(lowerAct.includes("categor") || lowerEnt.includes("categor"))) return false;
      if (entityFilter === "Suppliers" && !(lowerAct.includes("supplier") || lowerEnt.includes("supplier"))) return false;
      if (entityFilter === "Supply" && !(lowerAct.includes("item") || lowerAct.includes("supply") || lowerEnt.includes("item") || lowerEnt.includes("supply"))) return false;
      if (entityFilter === "BOM / Recipes" && !(lowerAct.includes("recipe") || lowerAct.includes("bom") || lowerEnt.includes("recipe") || lowerEnt.includes("bom"))) return false;
      if (entityFilter === "Stock Adjustments / Cycle Counts" && !(lowerAct.includes("cycle") || lowerAct.includes("adjust") || lowerAct.includes("count") || lowerEnt.includes("cycle") || lowerEnt.includes("count"))) return false;
      if (entityFilter === "Stock Write-Offs" && !(lowerAct.includes("write-off") || lowerAct.includes("writeoff") || lowerEnt.includes("write-off") || lowerEnt.includes("writeoff") || lowerAct.includes("swo-") || lowerEnt.includes("swo-"))) return false;
      if (entityFilter === "Receipts / GRN" && !(lowerAct.includes("receipt") || lowerAct.includes("grn") || lowerEnt.includes("grn"))) return false;
      if (entityFilter === "Stock In" && !(lowerAct.includes("stock in") || lowerAct.includes("stock-in") || lowerEnt.includes("stock in") || lowerEnt.includes("stock-in"))) return false;
      if (entityFilter === "Discrepancies" && !(lowerAct.includes("discrepan") || lowerEnt.includes("discrepan"))) return false;
      if (entityFilter === "Returns" && !(lowerAct.includes("return") || lowerAct.includes("rtv") || lowerEnt.includes("rtv"))) return false;
      if (entityFilter === "Loss Reports" && !(lowerAct.includes("loss") || lowerEnt.includes("loss"))) return false;
      if (entityFilter === "Transfers" && !(lowerAct.includes("transfer") || lowerEnt.includes("transfer"))) return false;
      if (entityFilter === "Requests" && !(lowerAct.includes("request") || lowerAct.includes("str-") || lowerEnt.includes("str-") || lowerAct.includes("prodreq-") || lowerEnt.includes("prodreq-"))) return false;
      if (entityFilter === "Locations" && !(lowerAct.includes("location") || lowerEnt.includes("location") || lowerAct.includes("branch") || lowerEnt.includes("branch"))) return false;
      if (entityFilter === "Batches" && !(lowerAct.includes("batch") || lowerEnt.includes("batch"))) return false;
      if (entityFilter === "Material Issuances" && !(lowerAct.includes("issuance") || lowerAct.includes("material") || lowerEnt.includes("issuance"))) return false;
      if (entityFilter === "Quality Assurance" && !(lowerAct.includes("qa") || lowerAct.includes("quality") || lowerEnt.includes("qa"))) return false;
      if (entityFilter === "Purchase Orders" && !(lowerAct.includes("purchase order") || lowerAct.includes("po-") || lowerEnt.includes("po-"))) return false;
      if (entityFilter === "Requisitions" && !(lowerAct.includes("requisition") || lowerAct.includes("pr-") || lowerEnt.includes("pr-"))) return false;
      if (entityFilter === "Deliveries" && !(lowerAct.includes("deliver") || lowerEnt.includes("deliver"))) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matches =
        (log.id && log.id.toLowerCase().includes(q)) ||
        log.activity.toLowerCase().includes(q) ||
        log.entityName.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q);
      if (!matches) return false;
    }

    const logTime = parseLogTime(log.timestamp);
    if (!logTime) return true;
    const logDate = new Date(logTime);

    if (filterMode === "specific" && specificDate) {
      const [specYear, specMonth, specDay] = specificDate.split("-").map(Number);
      if (
        logDate.getFullYear() !== specYear ||
        logDate.getMonth() !== specMonth - 1 ||
        logDate.getDate() !== specDay
      )
        return false;
    }
    if (filterMode === "range") {
      if (startDate) {
        const [sy, sm, sd] = startDate.split("-").map(Number);
        const startTarget = new Date(sy, sm - 1, sd, 0, 0, 0);
        if (logDate < startTarget) return false;
      }
      if (endDate) {
        const [ey, em, ed] = endDate.split("-").map(Number);
        const endTarget = new Date(ey, em - 1, ed, 23, 59, 59);
        if (logDate > endTarget) return false;
      }
    }
    return true;
  });

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) return;
    const csvRows: string[] = [["Log ID", "Timestamp", "Activity", "Entity", "User", "Details"].join(",")];
    filteredLogs.forEach((log) => {
      csvRows.push([
        `"${log.id || ""}"`,
        `"${log.timestamp || ""}"`,
        `"${log.activity || ""}"`,
        `"${log.entityName || ""}"`,
        `"${log.user || ""}"`,
        '""',
      ].join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeTitle = (moduleTitle || formattedType).toLowerCase().replace(/[^a-z0-9]/g, "_");
    link.setAttribute("download", `${safeTitle}_transaction_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await downloadAuditLogsPdf(filteredLogs, {
        moduleTitle: moduleTitle || formattedType,
        entityFilter,
        filterMode,
        specificDate,
        startDate,
        endDate,
        searchQuery,
      });
    } catch (err) {
      console.error("Failed to generate PDF report:", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-background p-2 sm:p-4 transition-colors font-sans text-foreground">
      <div className="w-full max-w-full space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="outline" onClick={() => router.back()} className="mb-3 px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-sm">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <AuditLogsFilterBar
          entityOptions={entityOptions}
          entityFilter={entityFilter}
          setEntityFilter={(value) => { setEntityFilter(value); setCurrentPage(1); }}
          filterMode={filterMode} setFilterMode={(value) => { setFilterMode(value); setCurrentPage(1); }} specificDate={specificDate} setSpecificDate={(value) => { setSpecificDate(value); setCurrentPage(1); }}
          startDate={startDate} setStartDate={(value) => { setStartDate(value); setCurrentPage(1); }} endDate={endDate} setEndDate={(value) => { setEndDate(value); setCurrentPage(1); }}
          searchQuery={searchQuery} setSearchQuery={(value) => { setSearchQuery(value); setCurrentPage(1); }} onResetFilters={handleResetFilters} onDownloadPdf={handleDownloadPdf} downloadingPdf={downloadingPdf}
        />

        <AuditLogsTable
          logs={filteredLogs}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          emptyMessage={
            unavailable
              ? "Audit events are unavailable right now. Try again shortly."
              : logs.length === 0
                ? "No audit events have been recorded yet."
                : undefined
          }
        />
      </div>
    </div>
  );
}
