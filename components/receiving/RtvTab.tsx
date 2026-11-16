"use client";
import { useRouter } from "next/navigation";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useMemo, useTransition } from "react";
import { MoreHorizontal, Eye, Check, XCircle, Truck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { RtvRecord } from "./types";

export default function RtvTab({ initialReturns }: { initialReturns: RtvRecord[] }) {
  const router = useRouter();
  const rtvs = initialReturns;
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Details
  const [selectedRtv, setSelectedRtv] = useState<RtvRecord | null>(null);

  // Modals for actions
  const [approvingRtv, setApprovingRtv] = useState<RtvRecord | null>(null);
  const [rejectingRtv, setRejectingRtv] = useState<RtvRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [dispatchingRtv, setDispatchingRtv] = useState<RtvRecord | null>(null);
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRtvs = () => startRefresh(() => router.refresh());

  const handleApprove = async (rtv: RtvRecord) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await receiving.approveReturn(rtv.rtvId);
      if (res.data?.success) {
        setApprovingRtv(null);
        setSelectedRtv(null);
        fetchRtvs();
      } else {
        setActionError(res.data?.message || "Failed to approve return request.");
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to approve return request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRtv) return;
    if (!rejectionReason.trim()) {
      setRejectionError("Please provide a reason for rejecting this return request.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setRejectionError(null);
    try {
      const res = await receiving.rejectReturn(rejectingRtv.rtvId, {
        reason: rejectionReason.trim(),
      });
      if (res.data?.success) {
        setRejectingRtv(null);
        setRejectionReason("");
        setRejectionError(null);
        setSelectedRtv(null);
        fetchRtvs();
      } else {
        setActionError(res.data?.message || "Failed to reject return request.");
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to reject return request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchingRtv) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await receiving.dispatchReturn(dispatchingRtv.rtvId, {
        creditNoteNumber: creditNoteNumber.trim() || undefined,
      });
      if (res.data?.success) {
        setDispatchingRtv(null);
        setCreditNoteNumber("");
        setSelectedRtv(null);
        fetchRtvs();
      } else {
        setActionError(res.data?.message || "Failed to dispatch return shipment.");
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to dispatch return shipment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    rtvs.forEach((r) => {
      if (r.supplierName) set.add(r.supplierName);
    });
    return Array.from(set).sort();
  }, [rtvs]);

  // Filter
  const filtered = useMemo(() => {
    let filteredList = rtvs;

    if (supplierFilter !== "All") {
      filteredList = filteredList.filter((r) => r.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filteredList = filteredList.filter((r) => {
        return (
          r.rtvNumber?.toLowerCase().includes(s) ||
          r.ncrNumber?.toLowerCase().includes(s) ||
          r.discrepancyNumber?.toLowerCase().includes(s) ||
          r.grnNumber?.toLowerCase().includes(s) ||
          r.poNumber?.toLowerCase().includes(s) ||
          r.supplierName?.toLowerCase().includes(s) ||
          r.itemName?.toLowerCase().includes(s) ||
          r.returnReason?.toLowerCase().includes(s) ||
          (r as any).reason?.toLowerCase().includes(s) ||
          r.status?.toLowerCase().includes(s)
        );
      });
    }

    return filteredList;
  }, [rtvs, search, supplierFilter]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Return to Vendor Records ({rtvs.length})
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchRtvs}
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
            placeholder="Search supplier returns by Return to Vendor No., Supplier, or Item..."
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
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs px-4 py-4 min-w-[170px] w-44 whitespace-nowrap">Return to Vendor No.</th>
                <th className="sticky left-[170px] z-20 bg-muted/95 backdrop-blur-xs px-4 py-4 min-w-[130px] border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">Date</th>
                <th className="px-4 py-4">Supplier</th>
                <th className="px-4 py-4">Item</th>
                <th className="px-4 py-4 text-right">Return Qty</th>
                <th className="px-4 py-4">Reason</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="w-16 px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                    No supplier returns found
                  </td>
                </tr>
              ) : (
                paginatedList.map((rtv) => {
                const isPendingApproval = rtv.status === "PendingApproval" || rtv.status === "Pending Approval";
                const isPendingDispatch = rtv.status === "PendingDispatch" || rtv.status === "Pending Dispatch";

                return (
                  <tr key={rtv.rtvId} className="group hover:bg-muted/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap min-w-[170px] w-44 transition-colors">
                      {rtv.rtvNumber}
                    </td>
                    <td className="sticky left-[170px] z-10 bg-card group-hover:bg-muted/40 px-4 py-4 text-sm text-muted-foreground whitespace-nowrap min-w-[130px] border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] transition-colors">
                      {new Date(rtv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[160px] truncate" title={rtv.supplierName}>
                      {rtv.supplierName || `Supplier #${rtv.supplierId}`}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[160px] truncate" title={rtv.itemName}>
                      {rtv.itemName || `Item #${rtv.itemId}`}
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                      {(rtv.returnedQuantity ?? rtv.quantityReturned ?? 0).toLocaleString()} {rtv.uomName || "Units"}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground max-w-[180px] truncate" title={rtv.returnReason || (rtv as any).reason}>
                      {rtv.returnReason || (rtv as any).reason || "Defective stock"}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <StatusBadge status={rtv.status} />
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
                            onSelect={() => setSelectedRtv(rtv)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                          >
                            <Eye size={14} className="shrink-0" /> View Details
                          </DropdownMenuItem>
                          {isPendingApproval && (
                            <>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setApprovingRtv(rtv);
                                  setActionError(null);
                                }}
                                disabled={actionLoading}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer disabled:opacity-50"
                              >
                                <Check size={14} className="shrink-0" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRejectingRtv(rtv);
                                  setRejectionReason("");
                                  setRejectionError(null);
                                  setActionError(null);
                                }}
                                disabled={actionLoading}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer disabled:opacity-50"
                              >
                                <XCircle size={14} className="shrink-0" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {isPendingDispatch && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setDispatchingRtv(rtv);
                                setCreditNoteNumber("");
                                setActionError(null);
                              }}
                              disabled={actionLoading}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer disabled:opacity-50"
                            >
                              <Truck size={14} className="shrink-0" /> Dispatch
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

      {/* VIEW RTV DETAILS MODAL */}
      {selectedRtv && (
        <ModalWrapper
          open={!!selectedRtv}
          title={`Supplier Return Details — ${selectedRtv.rtvNumber}`}
          onClose={() => setSelectedRtv(null)}
          size="max-w-2xl"
        >
          <div className="space-y-5 text-foreground text-sm">
            {/* Status Summary Banner */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-base text-foreground">
                  Return to Vendor
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Physical return documentation and quarantine disposition record.
                </p>
              </div>
              <StatusBadge status={selectedRtv.status} />
            </div>

            {/* Traceability Grid */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Return to Vendor No.</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedRtv.rtvNumber}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Source Discrepancy</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedRtv.discrepancyNumber || "Direct"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Source Goods Receipt Note</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedRtv.grnNumber || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Purchase Order</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{selectedRtv.poNumber || "—"}</div>
              </div>
            </div>

            {/* Item & Return Details */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Item Description</div>
                  <div className="font-semibold text-sm text-foreground mt-0.5">{selectedRtv.itemName || `Item #${selectedRtv.itemId}`}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-muted-foreground">Quantity to Return</div>
                  <div className="font-semibold text-sm text-foreground mt-0.5">
                    {(selectedRtv.returnedQuantity ?? selectedRtv.quantityReturned ?? 0).toLocaleString()} {selectedRtv.uomName || "Units"}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Supplier</div>
                <div className="text-sm font-semibold text-foreground">{selectedRtv.supplierName || `Supplier #${selectedRtv.supplierId}`}</div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Reason for Return</div>
                <div className="bg-card p-3 rounded-xl border border-border text-sm text-foreground">
                  {selectedRtv.returnReason || (selectedRtv as any).reason || "Defective stock"}
                </div>
              </div>

              {selectedRtv.creditNoteNumber && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Supplier Credit Note</div>
                  <div className="bg-muted/40 p-2.5 rounded-xl text-sm text-foreground">
                    {selectedRtv.creditNoteNumber}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Lower right corner */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
              <ModalNativeCloseButton
                fallbackOnClose={() => setSelectedRtv(null)}
                className="rounded-xl border border-border bg-card text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors shadow-sm cursor-pointer"
              >
                Close
              </ModalNativeCloseButton>
              {(selectedRtv.status === "PendingApproval" || selectedRtv.status === "Pending Approval") && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedRtv;
                      setRejectingRtv(target);
                      setRejectionReason("");
                      setRejectionError(null);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovingRtv(selectedRtv);
                      setActionError(null);
                    }}
                    disabled={actionLoading}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    Approve Return
                  </button>
                </>
              )}
              {(selectedRtv.status === "PendingDispatch" || selectedRtv.status === "Pending Dispatch") && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedRtv;
                    setDispatchingRtv(target);
                    setCreditNoteNumber("");
                    setActionError(null);
                  }}
                  disabled={actionLoading}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Dispatch Shipment
                </button>
              )}
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* APPROVE RTV MODAL (440px PO / PR Format) */}
      <ActionConfirmModal
        open={Boolean(approvingRtv)}
        title="Approve Return Request"
        subtitle={approvingRtv ? `Return to Vendor No: ${approvingRtv.rtvNumber}` : undefined}
        description={
          approvingRtv
            ? `Are you sure you want to approve return request ${approvingRtv.rtvNumber} for ${(approvingRtv.returnedQuantity ?? approvingRtv.quantityReturned ?? 0).toLocaleString()} ${approvingRtv.uomName || "Units"} of ${approvingRtv.itemName} to ${approvingRtv.supplierName}? This will authorize the return shipment for dispatch.`
            : ""
        }
        confirmText="Confirm Approval"
        loading={actionLoading}
        loadingText="Approving..."
        errorMessage={actionError}
        onConfirm={() => {
          if (approvingRtv) return handleApprove(approvingRtv);
        }}
        onClose={() => {
          setApprovingRtv(null);
          setActionError(null);
        }}
      />

      {/* REJECT RTV MODAL (440px PO / PR Format) */}
      <ActionConfirmModal
        open={Boolean(rejectingRtv)}
        title="Reject Return Request"
        subtitle={rejectingRtv ? `Return to Vendor No: ${rejectingRtv.rtvNumber}` : undefined}
        description={
          rejectingRtv
            ? `Please provide a reason for rejecting supplier return request ${rejectingRtv.rtvNumber} (${(rejectingRtv.returnedQuantity ?? rejectingRtv.quantityReturned ?? 0).toLocaleString()} ${rejectingRtv.uomName || "Units"} of ${rejectingRtv.itemName}).`
            : ""
        }
        confirmText="Confirm Rejection"
        loading={actionLoading}
        loadingText="Rejecting..."
        errorMessage={actionError}
        onConfirm={handleConfirmReject}
        onClose={() => {
          setRejectingRtv(null);
          setRejectionReason("");
          setRejectionError(null);
          setActionError(null);
        }}
      >
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Rejection Reason <span className="text-destructive">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Explain why this supplier return request is being rejected..."
            value={rejectionReason}
            onChange={(e) => {
              setRejectionReason(e.target.value);
              if (rejectionError) setRejectionError(null);
            }}
            className={`w-full bg-background border ${
              rejectionError ? "!border-destructive focus:!ring-destructive" : "border-border"
            } rounded-xl p-3 text-xs text-foreground resize-none focus:ring-1 focus:outline-none`}
          />
          {rejectionError && (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              {rejectionError}
            </p>
          )}
        </div>
      </ActionConfirmModal>

      {/* DISPATCH RTV MODAL (440px PO / PR Format) */}
      <ActionConfirmModal
        open={Boolean(dispatchingRtv)}
        title="Dispatch Return Shipment"
        subtitle={dispatchingRtv ? `Return to Vendor No: ${dispatchingRtv.rtvNumber}` : undefined}
        description={
          dispatchingRtv
            ? `Are you sure you want to dispatch ${(dispatchingRtv.returnedQuantity ?? dispatchingRtv.quantityReturned ?? 0).toLocaleString()} ${dispatchingRtv.uomName || "Units"} of ${dispatchingRtv.itemName} back to ${dispatchingRtv.supplierName}? This will remove the quarantined items and log the return in the stock ledger.`
            : ""
        }
        confirmText="Confirm Dispatch"
        loading={actionLoading}
        loadingText="Dispatching..."
        errorMessage={actionError}
        onConfirm={handleConfirmDispatch}
        onClose={() => {
          setDispatchingRtv(null);
          setCreditNoteNumber("");
          setActionError(null);
        }}
      >
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Supplier Credit Note / Settlement Ref (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. CN-2026-9901"
            value={creditNoteNumber}
            onChange={(e) => setCreditNoteNumber(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
          />
        </div>
      </ActionConfirmModal>
    </div>
  );
}
