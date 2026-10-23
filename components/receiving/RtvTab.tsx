"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, MoreHorizontal, Eye, Check, XCircle, Truck, AlertCircle } from "lucide-react";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import Pagination from "@/components/Pagination";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { RtvRecord } from "./types";

export default function RtvTab() {
  const [rtvs, setRtvs] = useState<RtvRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Dropdown & details
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);
  const [selectedRtv, setSelectedRtv] = useState<RtvRecord | null>(null);

  // Modals for actions
  const [rejectingRtv, setRejectingRtv] = useState<RtvRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [dispatchingRtv, setDispatchingRtv] = useState<RtvRecord | null>(null);
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-actions-dropdown]")) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const fetchRtvs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/ReturnToVendors");
      if (res.data?.success) {
        setRtvs(res.data.data || []);
      }
    } catch (err: any) {
      console.error("Error fetching RTVs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRtvs();
  }, [fetchRtvs]);

  const handleApprove = async (rtv: RtvRecord) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.post(`/api/ReturnToVendors/${rtv.rtvId}/approve`);
      if (res.data?.success) {
        await fetchRtvs();
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
      const res = await api.post(`/api/ReturnToVendors/${rejectingRtv.rtvId}/reject`, {
        reason: rejectionReason.trim(),
      });
      if (res.data?.success) {
        setRejectingRtv(null);
        setRejectionReason("");
        setRejectionError(null);
        await fetchRtvs();
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
      const res = await api.post(`/api/ReturnToVendors/${dispatchingRtv.rtvId}/dispatch`, {
        creditNoteNumber: creditNoteNumber.trim() || undefined,
      });
      if (res.data?.success) {
        setDispatchingRtv(null);
        setCreditNoteNumber("");
        await fetchRtvs();
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
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Return to Vendor Records ({rtvs.length})
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchRtvs}
            disabled={loading}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center border border-border rounded-md bg-card px-2 py-2">
        <div className="flex flex-1 items-center gap-2 px-2 bg-muted/20 h-full rounded-md">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Search supplier returns by Return to Vendor No., Supplier, or Item..."
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

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground animate-pulse">
          Loading Supplier Returns...
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Return to Vendor No.</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-3 py-3 text-right">Return Qty</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No supplier returns found
                  </td>
                </tr>
              ) : (
                paginatedList.map((rtv) => {
                const isPendingApproval = rtv.status === "PendingApproval" || rtv.status === "Pending Approval";
                const isPendingDispatch = rtv.status === "PendingDispatch" || rtv.status === "Pending Dispatch";

                return (
                  <tr key={rtv.rtvId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground whitespace-nowrap">
                      {rtv.rtvNumber}
                      <div className="text-[10px] text-muted-foreground font-sans">
                        {new Date(rtv.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate" title={rtv.supplierName}>
                      {rtv.supplierName || `Supplier #${rtv.supplierId}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate" title={rtv.itemName}>
                      {rtv.itemName || `Item #${rtv.itemId}`}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                      {(rtv.returnedQuantity ?? rtv.quantityReturned ?? 0).toLocaleString()} {rtv.uomName || "Units"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate" title={rtv.returnReason || (rtv as any).reason}>
                      {rtv.returnReason || (rtv as any).reason || "Defective stock"}
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <StatusBadge status={rtv.status} />
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap relative" data-actions-dropdown>
                      <button
                        type="button"
                        onClick={() => setActiveDropdownId(activeDropdownId === rtv.rtvId ? null : rtv.rtvId)}
                        className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                        title="Actions"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {activeDropdownId === rtv.rtvId && (
                        <div className="absolute right-6 top-2 z-[100] w-40 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left animate-in fade-in-50">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRtv(rtv);
                              setActiveDropdownId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <Eye size={14} className="shrink-0" /> View Details
                          </button>
                          {isPendingApproval && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  handleApprove(rtv);
                                  setActiveDropdownId(null);
                                }}
                                disabled={actionLoading}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                              >
                                <Check size={14} className="shrink-0" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingRtv(rtv);
                                  setRejectionReason("");
                                  setRejectionError(null);
                                  setActionError(null);
                                  setActiveDropdownId(null);
                                }}
                                disabled={actionLoading}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                              >
                                <XCircle size={14} className="shrink-0" /> Reject
                              </button>
                            </>
                          )}
                          {isPendingDispatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchingRtv(rtv);
                                setCreditNoteNumber("");
                                setActionError(null);
                                setActiveDropdownId(null);
                              }}
                              disabled={actionLoading}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              <Truck size={14} className="shrink-0" /> Dispatch
                            </button>
                          )}
                        </div>
                      )}
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
          <div className="space-y-5 text-foreground text-xs">
            {/* Status Summary Banner */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-foreground">
                  Return to Vendor
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Physical return documentation and quarantine disposition record.
                </p>
              </div>
              <StatusBadge status={selectedRtv.status} />
            </div>

            {/* Traceability Grid */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Return to Vendor No.</div>
                <div className="font-mono font-semibold text-xs mt-0.5">{selectedRtv.rtvNumber}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Source Discrepancy</div>
                <div className="font-mono font-semibold text-xs mt-0.5">{selectedRtv.discrepancyNumber || "Direct"}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Source Goods Receipt Note</div>
                <div className="font-mono font-semibold text-xs mt-0.5">{selectedRtv.grnNumber || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Purchase Order</div>
                <div className="font-mono font-semibold text-xs mt-0.5">{selectedRtv.poNumber || "—"}</div>
              </div>
            </div>

            {/* Item & Return Details */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-muted-foreground text-[11px]">Item Description</div>
                  <div className="font-semibold text-sm">{selectedRtv.itemName || `Item #${selectedRtv.itemId}`}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[11px]">Quantity to Return</div>
                  <div className="font-mono font-bold text-sm text-foreground">
                    {(selectedRtv.returnedQuantity ?? selectedRtv.quantityReturned ?? 0).toLocaleString()} {selectedRtv.uomName || "Units"}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-muted-foreground font-semibold mb-1">Supplier:</div>
                <div className="font-medium text-foreground">{selectedRtv.supplierName || `Supplier #${selectedRtv.supplierId}`}</div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-muted-foreground font-semibold mb-1">Reason for Return:</div>
                <div className="bg-card p-3 rounded-lg border border-border text-foreground">
                  {selectedRtv.returnReason || (selectedRtv as any).reason || "Defective stock"}
                </div>
              </div>

              {selectedRtv.creditNoteNumber && (
                <div className="border-t border-border pt-3">
                  <div className="text-muted-foreground font-semibold mb-1">Supplier Credit Note:</div>
                  <div className="bg-muted/40 p-2.5 rounded-lg text-foreground font-mono text-xs">
                    {selectedRtv.creditNoteNumber}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Lower right corner */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
              <button
                type="button"
                onClick={() => setSelectedRtv(null)}
                className="rounded-xl border border-border bg-card text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-colors shadow-sm"
              >
                Close
              </button>
              {(selectedRtv.status === "PendingApproval" || selectedRtv.status === "Pending Approval") && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedRtv;
                      setSelectedRtv(null);
                      setRejectingRtv(target);
                      setRejectionReason("");
                      setRejectionError(null);
                    }}
                    disabled={actionLoading}
                    className="rounded-xl border border-border bg-card text-foreground px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleApprove(selectedRtv);
                      setSelectedRtv(null);
                    }}
                    disabled={actionLoading}
                    className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-xs font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50"
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
                    setSelectedRtv(null);
                    setDispatchingRtv(target);
                    setCreditNoteNumber("");
                  }}
                  disabled={actionLoading}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50"
                >
                  Dispatch Shipment
                </button>
              )}
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* REJECT RTV MODAL */}
      {rejectingRtv && (
        <ModalWrapper
          open={!!rejectingRtv}
          title={`Reject Return Request - ${rejectingRtv.rtvNumber}`}
          onClose={() => {
            setRejectingRtv(null);
            setRejectionReason("");
            setRejectionError(null);
            setActionError(null);
          }}
          size="max-w-md"
        >
          <div className="space-y-4 text-foreground text-xs">
            {actionError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
                <span className="font-medium">{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="font-bold underline ml-2 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="bg-muted/20 border border-border rounded-xl p-3 space-y-1">
              <div className="font-semibold text-foreground">{rejectingRtv.itemName}</div>
              <div className="text-muted-foreground">
                Quantity: {(rejectingRtv.returnedQuantity ?? rejectingRtv.quantityReturned ?? 0).toLocaleString()} {rejectingRtv.uomName || "Units"}
              </div>
              <div className="text-muted-foreground">
                Supplier: {rejectingRtv.supplierName}
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">
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
                className={`w-full bg-card border ${
                  rejectionError ? "!border-destructive focus:!ring-destructive" : "border-border"
                } rounded-xl p-2.5 text-xs text-foreground focus:ring-1 focus:outline-none`}
              />
              {rejectionError && (
                <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                  {rejectionError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingRtv(null);
                  setRejectionError(null);
                  setActionError(null);
                }}
                disabled={actionLoading}
                className="rounded-xl border border-border bg-card text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* DISPATCH RTV MODAL */}
      {dispatchingRtv && (
        <ModalWrapper
          open={!!dispatchingRtv}
          title={`Dispatch Return Shipment - ${dispatchingRtv.rtvNumber}`}
          onClose={() => {
            setDispatchingRtv(null);
            setCreditNoteNumber("");
            setActionError(null);
          }}
          size="max-w-md"
        >
          <div className="space-y-4 text-foreground text-xs">
            {actionError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
                <span className="font-medium">{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="font-bold underline ml-2 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="bg-muted/20 border border-border rounded-xl p-3 space-y-1">
              <div className="font-semibold text-foreground">{dispatchingRtv.itemName}</div>
              <div className="text-muted-foreground">
                Returning {(dispatchingRtv.returnedQuantity ?? dispatchingRtv.quantityReturned ?? 0).toLocaleString()} {dispatchingRtv.uomName || "Units"} to {dispatchingRtv.supplierName}
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Dispatching will physically remove the stock from quarantine/holding and log the transfer in the inventory ledger.
              </p>
            </div>

            <div>
              <label className="font-semibold block mb-1">Supplier Credit Note / Settlement Ref (Optional)</label>
              <input
                type="text"
                placeholder="e.g. CN-2026-9901"
                value={creditNoteNumber}
                onChange={(e) => setCreditNoteNumber(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchingRtv(null)}
                disabled={actionLoading}
                className="rounded-xl border border-border bg-card text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={actionLoading}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {actionLoading ? "Dispatching..." : "Confirm Dispatch"}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}
