"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { listBatches as productionListBatches } from "@/app/actions/production/batches";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState } from "react";
import { AlertOctagon, FileText, X, Eye, RefreshCw, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { LossReport } from "./types";
import { toast } from "sonner";

import { lossReportsFromBatches } from "@/lib/production/loss-reports";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";

export default function LossTab({ initialRows }: { initialRows: Parameters<typeof lossReportsFromBatches>[0] }) {
  const [lossReports, setLossReports] = useState<LossReport[]>(() => lossReportsFromBatches(initialRows));
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<LossReport | null>(null);
  const { requestClose: requestCloseReport, confirmModal: reportCloseConfirm } = useConfirmedClose(() =>
    setSelectedReport(null)
  );

  const fetchLossReports = async () => {
    try {
      setLoading(true);

      // Fetch rejected batches from backend API
      const batchesRes = await actionResponse(productionListBatches());
      const batches = Array.isArray(batchesRes.data)
        ? batchesRes.data
        : Array.isArray(batchesRes.data?.data)
          ? batchesRes.data.data
          : [];

      setLossReports(lossReportsFromBatches(batches));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load loss reports");
    } finally {
      setLoading(false);
    }
  };


  const totalLossBatches = lossReports.length;
  const totalFinancialLoss = lossReports.reduce((sum, r) => sum + r.totalEstimatedLoss, 0);
  const totalUnitsLost = lossReports.reduce((sum, r) => sum + (r.targetYield || 0), 0);

  const filteredReports = lossReports.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.lossId?.toLowerCase().includes(q) ||
      r.batchNumber?.toLowerCase().includes(q) ||
      r.productName?.toLowerCase().includes(q) ||
      r.rejectionReason?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="type-page-title text-text-primary">Production Loss Reports</h2>
          <p className="type-body text-text-muted mt-0.5">
            Automatic loss tracking and cost accounting for QA-rejected and compromised batches.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLossReports}
          disabled={loading}
          className="flex items-center gap-1.5 h-9 rounded-control border border-divider bg-surface hover:bg-surface-hover font-semibold type-caption text-text-primary cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1 */}
        <div className="rounded-card border border-divider bg-surface p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="type-overline tracking-wider text-text-muted uppercase">
              Total Loss Batches
            </span>
            <svg className="w-20 h-6 text-text-primary" viewBox="0 0 80 24" fill="none">
              <path
                d="M 2 8 C 14 10, 24 18, 38 14 C 52 10, 62 20, 76 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="76" cy="18" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="type-kpi font-semibold tracking-tight text-text-primary">
              {totalLossBatches}
            </div>
            <p className="type-caption text-text-muted mt-1">
              Batches rejected during QA or preparation
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-card border border-divider bg-surface p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="type-overline tracking-wider text-text-muted uppercase">
              Estimated Financial Loss
            </span>
            <svg className="w-20 h-6 text-text-muted/70" viewBox="0 0 80 24" fill="none">
              <path
                d="M 2 6 C 14 8, 26 18, 40 12 C 54 18, 64 20, 76 22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="76" cy="22" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="type-kpi font-semibold tracking-tight text-text-primary">
              ₱{totalFinancialLoss.toLocaleString()}
            </div>
            <p className="type-caption text-text-muted mt-1">
              Cost of consumed ingredients &amp; supplies
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="rounded-card border border-divider bg-surface p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="type-overline tracking-wider text-text-muted uppercase">
              Total Volume Forfeited
            </span>
            <svg className="w-20 h-6 text-text-primary" viewBox="0 0 80 24" fill="none">
              <path
                d="M 2 16 C 16 12, 30 18, 44 8 C 58 16, 68 6, 76 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="76" cy="10" r="2.5" fill="currentColor" />
            </svg>
          </div>
          <div className="mt-4">
            <div className="type-kpi font-semibold tracking-tight text-text-primary">
              {totalUnitsLost.toLocaleString()} PCS
            </div>
            <p className="type-caption text-text-muted mt-1">
              Target units that failed food safety / sensory
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="rounded-card border border-divider bg-surface p-3 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by loss report ID, batch number, or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="text-xs text-muted-foreground font-medium pl-1 hidden sm:inline">
            Showing {filteredReports.length} records
          </span>
        </div>
      </div>

      {/* Loss Reports Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <ProductionSkeleton />
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {searchQuery
              ? `No loss reports found matching "${searchQuery}".`
              : "No production losses recorded. All active batches have passed inspections."}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                  <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs px-4 py-4 min-w-[130px] w-36 whitespace-nowrap border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">Loss ID</th>
                  <th className="px-4 py-4 whitespace-nowrap">Batch Number</th>
                  <th className="px-4 py-4">Product Name</th>
                  <th className="px-4 py-4">Variant</th>
                  <th className="px-4 py-4">Failure Stage</th>
                  <th className="px-4 py-4">Date Logged</th>
                  <th className="px-4 py-4 text-right">Estimated Loss</th>
                  <th className="w-16 px-4 py-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((report) => (
                  <tr
                    key={report.lossId}
                    onClick={() => setSelectedReport(report)}
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap min-w-[130px] w-36 border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] transition-colors">
                      {report.lossId}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {report.batchNumber}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground whitespace-nowrap">
                      {report.productName}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {report.variant}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                        <AlertOctagon size={13} /> {report.failureStage}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(report.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-destructive text-right whitespace-nowrap">
                      ₱{report.totalEstimatedLoss.toLocaleString()}
                    </td>
                    <td className="w-16 px-4 py-4 text-center relative whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-none"
                              title="Actions"
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border border-border bg-card shadow-xl p-1.5 text-left z-[100]">
                            <DropdownMenuItem
                              onClick={() => setSelectedReport(report)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer rounded-lg transition-colors outline-none"
                            >
                              <Eye size={14} className="shrink-0 text-muted-foreground" />
                              <span>View Breakdown</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loss Report Breakdown Modal */}
      {selectedReport && (
        <div className="font-sans fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          {reportCloseConfirm}
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-destructive text-destructive-foreground flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Loss Report: {selectedReport.lossId}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Batch {selectedReport.batchNumber} &bull; {selectedReport.productName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestCloseReport}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto type-body">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-control border border-divider bg-surface-secondary/40 type-caption">
                <div>
                  <span className="type-overline text-text-muted uppercase font-semibold block">
                    Product &amp; Variant
                  </span>
                  <span className="font-semibold type-body text-text-primary">{selectedReport.productName}</span>
                  <div className="text-text-muted type-caption">{selectedReport.variant}</div>
                </div>
                <div>
                  <span className="type-overline text-text-muted uppercase font-semibold block">
                    Target Yield
                  </span>
                  <span className="font-semibold type-body text-text-primary">
                    {selectedReport.targetYield} PCS
                  </span>
                </div>
                <div>
                  <span className="type-overline text-text-muted uppercase font-semibold block">
                    Logged Date
                  </span>
                  <span className="font-semibold type-body text-text-primary">
                    {new Date(selectedReport.date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="type-overline text-text-muted uppercase font-semibold block">
                    Estimated Loss
                  </span>
                  <span className="font-semibold text-badge-danger-text type-body">
                    ₱{selectedReport.totalEstimatedLoss.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Rejection reason & inspector */}
              <div className="p-4 rounded-control border border-divider bg-surface-secondary/40 space-y-1.5 type-caption">
                <span className="type-table-header uppercase tracking-wider text-text-muted block">
                  Rejection Reason &amp; Inspector Assessment
                </span>
                <p className="font-semibold text-text-primary type-body">{selectedReport.rejectionReason}</p>
                {selectedReport.notes && (
                  <p className="text-text-muted type-caption italic">"{selectedReport.notes}"</p>
                )}
                <p className="type-caption text-text-muted pt-1">
                  Evaluated by: <span className="font-semibold text-text-primary">{selectedReport.inspector}</span>
                </p>
              </div>

              {/* Lost Ingredients Breakdown Table */}
              <div>
                <h4 className="type-table-header uppercase tracking-wider text-text-primary mb-2">
                  Issued Ingredients &amp; Supplies Forfeited ({selectedReport.items.length})
                </h4>
                <div className="border border-divider rounded-control overflow-hidden bg-surface shadow-card">
                  <table className="w-full text-left border-collapse type-body">
                    <thead className="border-b border-divider bg-surface-secondary">
                      <tr className="table-head-row text-left type-table-header uppercase text-text-muted whitespace-nowrap">
                        <th className="table-th px-4 py-3">Item Name</th>
                        <th className="table-th px-4 py-3">Lot Number</th>
                        <th className="table-th px-4 py-3">Quantity</th>
                        <th className="table-th px-4 py-3">Unit Cost</th>
                        <th className="table-th px-4 py-3 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {selectedReport.items.map((item, idx) => (
                        <tr key={idx} className="table-row hover:bg-surface-hover/50">
                          <td className="table-td px-4 py-3 type-body font-semibold text-text-primary">
                            {item.itemName}
                          </td>
                          <td className="table-td px-4 py-3 type-body text-text-muted">
                            {item.lotNumber}
                          </td>
                          <td className="table-td px-4 py-3 type-body text-text-muted">
                            {item.quantity} {item.uom}
                          </td>
                          <td className="table-td px-4 py-3 type-body text-text-muted">₱{item.unitCost.toFixed(2)}</td>
                          <td className="table-td px-4 py-3 type-body font-semibold text-text-primary text-right">
                            ₱{item.totalCost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-secondary font-semibold border-t border-divider">
                      <tr className="table-head-row">
                        <td colSpan={4} className="table-td py-3 px-4 text-right uppercase type-caption font-semibold text-text-muted">
                          Total Loss Value:
                        </td>
                        <td className="table-td py-3 px-4 text-right type-body font-semibold text-badge-danger-text">
                          ₱{selectedReport.totalEstimatedLoss.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-divider bg-surface-secondary/40">
              <Button
                type="button"
                variant="outline"
                onClick={requestCloseReport}
                className="type-caption font-semibold rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary cursor-pointer px-5 py-2"
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
