"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useMemo, useTransition } from "react";
import { MoreHorizontal, Eye, Check, History } from "lucide-react";
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
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";
import { LossReport } from "./types";

export default function LossReportTab({ initialLossReports }: { initialLossReports: LossReport[] }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
  const lossReports = initialLossReports;
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedReport, setSelectedReport] = useState<LossReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmAckReport, setConfirmAckReport] = useState<LossReport | null>(null);
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || "Failed to acknowledge loss report.");
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
        <div className="type-overline uppercase text-text-muted">
          Loss & Disposal Reports ({lossReports.length})
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchLossReports}
            disabled={loading}
            className="h-10 rounded-control border border-divider bg-surface px-4 py-2 type-body font-semibold text-text-primary hover:bg-surface-secondary cursor-pointer shadow-card"
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-control border border-divider bg-surface px-4 py-2 type-body font-semibold text-text-primary hover:bg-surface-secondary cursor-pointer shadow-card"
            >
              <Link href="/goods-receiving/logs">
                <History className="w-4 h-4 mr-1.5" />
                Transaction History
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center rounded-card border border-divider bg-surface p-3">
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
              <SelectTrigger aria-label="Filter by supplier" className="h-10 w-[180px] rounded-control border border-divider bg-surface px-3 type-body font-medium text-text-primary shadow-card focus:border-border-focus">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent align="end" className="type-caption z-[9999]">
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
        <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
          <table className="w-full border-collapse">
            <thead className="border-b border-divider bg-surface-secondary">
              <tr className="table-head-row text-left whitespace-nowrap">
                <th className="sticky left-0 z-20 bg-surface-secondary table-th px-4 py-3 min-w-[150px] w-44 whitespace-nowrap border-r border-divider shadow-sticky">Report No.</th>
                <th className="table-th px-4 py-3 whitespace-nowrap">Date</th>
                <th className="table-th px-4 py-3">Item Name</th>
                <th className="table-th px-4 py-3 text-right">Lost Qty</th>
                <th className="table-th px-4 py-3">Reason</th>
                <th className="table-th px-4 py-3 text-center">Status</th>
                <th className="table-th w-16 px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center type-body text-text-muted">
                    No loss reports found
                  </td>
                </tr>
              ) : (
                paginatedList.map((r) => {
                const isAck = !!r.isAcknowledged;
                return (
                  <tr key={r.lossReportId} className="table-row group hover:bg-surface-secondary/50 transition-colors">
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-secondary/50 px-4 py-3 table-td font-semibold text-text-primary whitespace-nowrap min-w-[150px] w-44 border-r border-divider shadow-sticky transition-colors">
                      {r.lossReportNumber}
                    </td>
                    <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 table-td font-medium text-text-primary max-w-[200px] truncate" title={r.itemName}>
                      {r.itemName}
                    </td>
                    <td className="px-4 py-3 table-td text-right font-semibold text-text-primary whitespace-nowrap">
                      {r.lostQuantity.toLocaleString()} {r.uomName || "Units"}
                    </td>
                    <td className="px-4 py-3 table-td text-text-muted max-w-[220px] truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {isAck ? (
                        <span className="inline-flex items-center type-caption font-semibold px-2.5 py-0.5 rounded-control bg-badge-success-bg border border-badge-success-border text-badge-success-text">
                          Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center type-caption font-semibold px-2.5 py-0.5 rounded-control bg-surface-secondary border border-divider text-text-muted">
                          Awaiting Ack
                        </span>
                      )}
                    </td>
                    <td className="w-16 px-4 py-3 text-center whitespace-nowrap relative">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Record actions"
                            className="p-1.5 rounded-control text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none cursor-pointer"
                            title="Actions"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 rounded-control border border-divider bg-surface shadow-modal py-1.5 text-left"
                        >
                          <DropdownMenuItem
                            onSelect={() => handleSelectReport(r)}
                            className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer"
                          >
                            <Eye size={14} className="shrink-0" /> View Details
                          </DropdownMenuItem>
                          {!isAck && (
                            <DropdownMenuItem
                              onSelect={() => setConfirmAckReport(r)}
                              disabled={actionLoadingId !== null}
                              className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer disabled:opacity-50"
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
        <div className="p-4 border-t border-divider">
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
          size="max-w-[640px]"
        >
          <div className="space-y-5 text-text-primary type-body">
            {error && (
              <div className="rounded-control border border-badge-danger-border bg-badge-danger-bg p-3 type-body text-badge-danger-text flex items-center justify-between">
                <span className="font-medium">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="font-semibold underline ml-2 shrink-0 cursor-pointer type-caption"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Status Summary Banner */}
            <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold type-section-title text-text-primary">
                  Authorized Stock Write-Off
                </div>
                <p className="text-text-muted mt-0.5 type-caption">
                  Certifies physical loss, damage, or rejection write-off and adjusts ledger balance.
                </p>
              </div>
              {selectedReport.isAcknowledged ? (
                <span className="inline-flex items-center type-caption font-semibold px-2.5 py-0.5 rounded-control bg-badge-success-bg border border-badge-success-border text-badge-success-text">
                  Acknowledged
                </span>
              ) : (
                <span className="inline-flex items-center type-caption font-semibold px-2.5 py-0.5 rounded-control bg-surface-secondary border border-divider text-text-muted">
                  Pending Admin Acknowledgement
                </span>
              )}
            </div>

            {/* Traceability Grid */}
            <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="type-caption font-medium text-text-muted">Report No.</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedReport.lossReportNumber}</div>
              </div>
              <div>
                <div className="type-caption font-medium text-text-muted">Source Discrepancy</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedReport.discrepancyNumber || "Direct"}</div>
              </div>
              <div>
                <div className="type-caption font-medium text-text-muted">Source Goods Receipt Note</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedReport.grnNumber || "—"}</div>
              </div>
              <div>
                <div className="type-caption font-medium text-text-muted">Purchase Order</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedReport.poNumber || "—"}</div>
              </div>
            </div>

            {/* Item & Loss Detail */}
            <div className="border border-divider rounded-control p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="type-caption font-medium text-text-muted">Item Description</div>
                  <div className="font-semibold type-body text-text-primary mt-0.5">{selectedReport.itemName}</div>
                </div>
                <div className="text-right">
                  <div className="type-caption font-medium text-text-muted">Quantity Written Off</div>
                  <div className="font-semibold type-body text-text-primary mt-0.5">
                    {selectedReport.lostQuantity.toLocaleString()} {selectedReport.uomName || "Units"}
                  </div>
                </div>
              </div>

              {selectedReport.supplierName && selectedReport.supplierName !== "—" && (
                <div className="border-t border-divider pt-3">
                  <div className="type-caption font-medium text-text-muted mb-1">Supplier</div>
                  <div className="type-body font-semibold text-text-primary">{selectedReport.supplierName}</div>
                </div>
              )}

              <div className="border-t border-divider pt-3">
                <div className="type-caption font-medium text-text-muted mb-1">Reason for Loss / Disposal</div>
                <div className="bg-surface p-3 rounded-control border border-divider type-body text-text-primary">
                  {selectedReport.reason}
                </div>
              </div>

              {selectedReport.notes && (
                <div className="border-t border-divider pt-3">
                  <div className="type-caption font-medium text-text-muted mb-1">Audit Notes</div>
                  <div className="bg-surface-secondary/40 p-2.5 rounded-control text-text-muted type-caption">
                    {selectedReport.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Acknowledgement Info Box */}
            <div className="border border-divider rounded-control p-3.5 bg-surface-secondary/30 space-y-1">
              <div className="type-caption text-text-muted">
                Authorised by: <strong className="text-text-primary">{selectedReport.authorisedBy || "System Admin"}</strong>
              </div>
              {selectedReport.acknowledgedBy ? (
                <div className="type-caption text-text-muted">
                  Acknowledged by: <strong className="text-text-primary">{selectedReport.acknowledgedBy}</strong>
                  {selectedReport.acknowledgedAt && ` on ${new Date(selectedReport.acknowledgedAt).toLocaleString()}`}
                </div>
              ) : (
                <div className="type-caption text-text-muted italic">
                  Not yet acknowledged by Inventory Admin.
                </div>
              )}
            </div>

            {/* Modal Footer - Lower right corner */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-divider mt-4">
              <ModalNativeCloseButton
                fallbackOnClose={() => setModalOpen(false)}
                disabled={actionLoadingId !== null}
                className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card cursor-pointer"
              >
                Close
              </ModalNativeCloseButton>
              {!selectedReport.isAcknowledged && (
                <button
                  type="button"
                  onClick={() => setConfirmAckReport(selectedReport)}
                  disabled={actionLoadingId !== null}
                  className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-card cursor-pointer"
                >
                  {actionLoadingId === selectedReport.lossReportId ? "Acknowledging..." : "Acknowledge This Report"}
                </button>
              )}
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Acknowledge Loss Report Confirmation Modal */}
      <ActionConfirmModal
        open={Boolean(confirmAckReport)}
        title="Acknowledge Loss Report"
        subtitle={confirmAckReport ? `Loss Report No: ${confirmAckReport.lossReportNumber}` : undefined}
        description={
          confirmAckReport
            ? `Are you sure you want to acknowledge Loss & Disposal Report ${confirmAckReport.lossReportNumber} for ${confirmAckReport.lostQuantity.toLocaleString()} ${confirmAckReport.uomName || "Units"} of ${confirmAckReport.itemName}?`
            : ""
        }
        confirmText="Confirm & Acknowledge"
        loading={Boolean(confirmAckReport && actionLoadingId === confirmAckReport.lossReportId)}
        loadingText="Acknowledging..."
        onConfirm={async () => {
          if (!confirmAckReport) return;
          await handleAcknowledge(confirmAckReport.lossReportId);
          setConfirmAckReport(null);
        }}
        onClose={() => setConfirmAckReport(null)}
      />
    </div>
  );
}
