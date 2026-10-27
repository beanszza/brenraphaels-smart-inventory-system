"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import AuditLogsFilterBar from "@/components/pages/AuditLogsFilterBar";
import AuditLogsTable, { LogEntry } from "@/components/pages/AuditLogsTable";

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

export default function ViewTransactionalLogs({ initialLogs, unavailable = false }: { initialLogs: LogEntry[]; unavailable?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams?.get("type") || "Supply";
  const logs = initialLogs;
  const formattedType = typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase();
  const title = `${formattedType} Transactional Audit Logs`;

  const [filterMode, setFilterMode] = useState<"all" | "specific" | "range">("all");
  const [specificDate, setSpecificDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);


  const handleResetFilters = () => {
    setFilterMode("all"); setSpecificDate(""); setStartDate(""); setEndDate(""); setSearchQuery(""); setCurrentPage(1);
  };

  const filteredLogs = logs.filter((log) => {
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
    link.setAttribute("download", `transaction_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-background p-2 sm:p-4 transition-colors font-sans text-foreground">
      <div className="w-full max-w-full space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="outline" onClick={() => router.back()} className="mb-3 px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors shadow-sm">
              Back
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Audit trail for Supply Add/Edit/Status, Recipe/BOM modifications, and Inventory movements</p>
          </div>
        </div>

        <AuditLogsFilterBar
          filterMode={filterMode} setFilterMode={(value) => { setFilterMode(value); setCurrentPage(1); }} specificDate={specificDate} setSpecificDate={(value) => { setSpecificDate(value); setCurrentPage(1); }}
          startDate={startDate} setStartDate={(value) => { setStartDate(value); setCurrentPage(1); }} endDate={endDate} setEndDate={(value) => { setEndDate(value); setCurrentPage(1); }}
          searchQuery={searchQuery} setSearchQuery={(value) => { setSearchQuery(value); setCurrentPage(1); }} onResetFilters={handleResetFilters} onExportCSV={handleExportCSV}
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
