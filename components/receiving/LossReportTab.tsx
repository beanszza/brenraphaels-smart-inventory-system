"use client";
import { useRouter } from "next/navigation";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useMemo, useTransition } from "react";
import { MoreHorizontal, Eye, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Pagination from "@/components/Pagination";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { LossReport } from "./types";

export default function LossReportTab({ initialLossReports }: { initialLossReports: LossReport[] }) {
  const router = useRouter();
  const lossReports = initialLossReports;
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedReport, setSelectedReport] = useState<LossReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLossReports = () => startRefresh(() => router.refresh());

  const handleAcknowledge = async (reportId: number) => {
    setActionLoadingId(reportId);
    setError(null);
    try {
      const res = await receiving.acknowledgeLoss(reportId);
      if (res.data?.success) {
        await fetchLossReports();
        if (selectedReport && selectedReport.lossReportId === reportId) {
          setSelectedReport(res.data.data);
        }
      } else {
        setError(res.data?.message || "Failed to acknowledge loss report.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to acknowledge loss report.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    lossReports.forEach((r) => {
      if (r.supplierName) set.add(r.supplierName);
    });
    return Array.from(set).sort();
  }, [lossReports]);

  // Filter
  const filtered = useMemo(() => {
    let filteredList = lossReports;

    if (supplierFilter !== "All") {
      filteredList = filteredList.filter((r) => r.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filteredList = filteredList.filter((r) => {
        return (
          r.lossReportNumber?.toLowerCase().includes(s) ||
          r.discrepancyNumber?.toLowerCase().includes(s) ||
          r.grnNumber?.toLowerCase().includes(s) ||
          r.poNumber?.toLowerCase().includes(s) ||
          r.prNumber?.toLowerCase().includes(s) ||
          r.supplierName?.toLowerCase().includes(s) ||
          r.itemName?.toLowerCase().includes(s) ||
          r.reason?.toLowerCase().includes(s) ||
          r.authorisedBy?.toLowerCase().includes(s) ||
          r.acknowledgedBy?.toLowerCase().includes(s)
        );
      });
    }

    return filteredList;
  }, [lossReports, search, supplierFilter]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleSelectReport = (report: LossReport) => {
    setSelectedReport(report);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Loss & Disposal Reports ({lossReports.length})
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchLossReports}
            disabled={loading}
            className="h-10 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted cursor-pointer"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center rounded-xl border border-border bg-card p-3">
        <div className="flex flex-1 items-center gap-2">
          <SearchInput
            aria-label="Search records"
            containerClassName="flex-1"
            placeholder="Search loss reports by Report#, Item, or Supplier..."
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
              className="text-xs text-muted-foreground hover:text-foreground font-medium px-2"
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
              <SelectTrigger aria-label="Filter by supplier" className="h-10 w-[180px] rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
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

      {/* Table */}
      {loading ? (
        <ReceivingSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                <th className="px-4 py-4">Report No.</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Item Name</th>
                <th className="px-4 py-4 text-right">Lost Qty</th>
                <th className="px-4 py-4">Reason</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="w-16 px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                    No loss reports found
                  </td>
                </tr>
              ) : (
                paginatedList.map((r) => {
                const isAck = !!r.isAcknowledged;
                return (
                  <tr key={r.lossReportId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                      {r.lossReportNumber}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[200px] truncate" title={r.itemName}>
                      {r.itemName}
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                      {r.lostQuantity.toLocaleString()} {r.uomName || "Units"}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground max-w-[220px] truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {isAck ? (
                        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted border border-border text-foreground">
                          Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted/50 border border-border text-muted-foreground">
                          Awaiting Ack
                        </span>
                      )}
                    </td>
                    <td className="w-16 px-4 py-4 text-center whitespace-nowrap relative">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Record actions"
                            className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                            title="Actions"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left"
                        >
                          <DropdownMenuItem
                            onSelect={() => handleSelectReport(r)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                          >
                            <Eye size={14} className="shrink-0" /> View Details
                          </DropdownMenuItem>
                          {!isAck && (
                            <DropdownMenuItem
                              onSelect={() => handleAcknowledge(r.lossReportId)}
                              disabled={actionLoadingId !== null}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer disabled:opacity-50"
                            >
                              <Check size={14} className="shrink-0" /> Acknowledge
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-border">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* View Loss Report Details Modal */}
      {selectedReport && (
        <ModalWrapper
          open={modalOpen}
          title={`Loss & Disposal Report — ${selectedReport.lossReportNumber}`}
          onClose={() => setModalOpen(false)}
          size="max-w-2xl"
        >
          <div className="space-y-5 text-foreground text-sm">
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center justify-between">
                <span className="font-medium">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="font-semibold underline ml-2 shrink-0 cursor-pointer text-xs"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Status Summary Banner */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-base text-foreground">
                  Authorized Stock Write-Off
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Certifies physical loss, damage, or rejection write-off and adjusts ledger balance.
                </p>
              </div>
              {selectedReport.isAcknowledged ? (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted border border-border text-foreground">
                  Acknowledged
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted/50 border border-border text-muted-foreground">
                  Pending Admin Acknowledgement
                </span>
              )}
            </div>

            {/* Traceability Grid */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Report No.</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedReport.lossReportNumber}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Source Discrepancy</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedReport.discrepancyNumber || "Direct"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Source Goods Receipt Note</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedReport.grnNumber || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Purchase Order</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedReport.poNumber || "—"}</div>
              </div>
            </div>

            {/* Item & Loss Detail */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Item Description</div>
                  <div className="font-semibold text-sm text-foreground mt-0.5">{selectedReport.itemName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-muted-foreground">Quantity Written Off</div>
                  <div className="font-semibold text-sm text-foreground mt-0.5">
                    {selectedReport.lostQuantity.toLocaleString()} {selectedReport.uomName || "Units"}
                  </div>
                </div>
              </div>

              {selectedReport.supplierName && selectedReport.supplierName !== "—" && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Supplier</div>
                  <div className="text-sm font-semibold text-foreground">{selectedReport.supplierName}</div>
                </div>
              )}

              <div className="border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Reason for Loss / Disposal</div>
                <div className="bg-card p-3 rounded-xl border border-border text-sm text-foreground">
                  {selectedReport.reason}
                </div>
              </div>

              {selectedReport.notes && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Audit Notes</div>
                  <div className="bg-muted/40 p-2.5 rounded-xl text-muted-foreground text-xs">
                    {selectedReport.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Acknowledgement Info Box */}
            <div className="border border-border rounded-xl p-3.5 bg-muted/10 space-y-1">
              <div className="text-xs text-muted-foreground">
                Authorised by: <strong className="text-foreground">{selectedReport.authorisedBy || "System Admin"}</strong>
              </div>
              {selectedReport.acknowledgedBy ? (
                <div className="text-xs text-muted-foreground">
                  Acknowledged by: <strong className="text-foreground">{selectedReport.acknowledgedBy}</strong>
                  {selectedReport.acknowledgedAt && ` on ${new Date(selectedReport.acknowledgedAt).toLocaleString()}`}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  Not yet acknowledged by Inventory Admin.
                </div>
              )}
            </div>

            {/* Modal Footer - Lower right corner */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
              <ModalNativeCloseButton
                fallbackOnClose={() => setModalOpen(false)}
                disabled={actionLoadingId !== null}
                className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
              >
                Close
              </ModalNativeCloseButton>
              {!selectedReport.isAcknowledged && (
                <button
                  type="button"
                  onClick={() => handleAcknowledge(selectedReport.lossReportId)}
                  disabled={actionLoadingId !== null}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                >
                  {actionLoadingId === selectedReport.lossReportId ? "Acknowledging..." : "Acknowledge This Report"}
                </button>
              )}
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
