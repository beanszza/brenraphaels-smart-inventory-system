"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useMemo, useTransition } from "react";
import { MoreHorizontal, Eye, Check, XCircle, Truck, History } from "lucide-react";
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
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";
import { RtvRecord } from "./types";

export default function RtvTab({ initialReturns }: { initialReturns: RtvRecord[] }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setActionError(e.response?.data?.message || e.message || "Failed to approve return request.");
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setActionError(e.response?.data?.message || e.message || "Failed to reject return request.");
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setActionError(e.response?.data?.message || e.message || "Failed to dispatch return shipment.");
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
    <div className="space-y-5 animate-page-in">
      {/* Top action row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-status-purple-bg text-primary type-label-tab w-fit">
          <span>Return to Vendor Records</span>
          <span className="tabular-nums">{rtvs.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchRtvs}
            disabled={loading}
            className="h-9 rounded-control border border-border bg-surface px-3.5 py-2 type-label-button text-ink hover:bg-subtle cursor-pointer shadow-none"
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-control border border-border bg-surface px-3.5 py-2 type-label-button text-ink hover:bg-subtle cursor-pointer shadow-none"
            >
              <Link href="/goods-receiving/logs">
                <History className="w-4 h-4 mr-1.5" />
                Transaction History
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Standalone Filters & Search Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={supplierFilter}
          onValueChange={(val) => {
            setSupplierFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by supplier" className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Supplier:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Suppliers" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            className="min-w-[230px] max-h-72"
          >
            <SelectItem value="All">All Suppliers</SelectItem>
            {uniqueSuppliers.map((supp) => (
              <SelectItem key={supp} value={supp}>
                {supp}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          aria-label="Search records"
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search RTV No., supplier, or item..."
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
            className="type-caption text-ink-muted hover:text-ink font-medium px-2 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Padded Table Card */}
      {loading ? (
        <ReceivingSkeleton />
      ) : (
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-b border-divider">
                  <th className="sticky left-0 z-20 bg-surface pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[160px]">Return to Vendor No.</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Date</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Supplier</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Item</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-right whitespace-nowrap">Return Qty</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Reason</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
                  <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
                      No supplier returns found
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((rtv) => {
                  const isPendingApproval = rtv.status === "PendingApproval" || rtv.status === "Pending Approval";
                  const isPendingDispatch = rtv.status === "PendingDispatch" || rtv.status === "Pending Dispatch";

                  return (
                    <tr key={rtv.rtvId} className="group hover:bg-page transition-colors">
                      <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[160px]">
                        {rtv.rtvNumber}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {new Date(rtv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink max-w-[160px] truncate" title={rtv.supplierName}>
                        {rtv.supplierName || `Supplier #${rtv.supplierId}`}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink max-w-[160px] truncate" title={rtv.itemName}>
                        {rtv.itemName || `Item #${rtv.itemId}`}
                      </td>
                      <td className="py-3 pr-4 type-body font-medium text-ink text-right whitespace-nowrap tabular-nums">
                        {(rtv.returnedQuantity ?? rtv.quantityReturned ?? 0).toLocaleString()} {rtv.uomName || "Units"}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink-muted max-w-[180px] truncate" title={rtv.returnReason || (rtv as { reason?: string }).reason}>
                        {rtv.returnReason || (rtv as { reason?: string }).reason || "Defective stock"}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <StatusBadge status={rtv.status} />
                      </td>
                      <td className="w-16 py-3 pl-4 text-center whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Record actions"
                              className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                              title="Actions"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onSelect={() => setSelectedRtv(rtv)}
                              className="cursor-pointer type-body-secondary"
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
                                  className="cursor-pointer type-body-secondary"
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
                                  className="cursor-pointer type-body-secondary text-destructive focus:text-destructive"
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
                                className="cursor-pointer type-body-secondary"
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

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            embedded
          />
        </div>
      )}

      {/* VIEW RTV DETAILS MODAL */}
      {selectedRtv && (
        <ModalWrapper
          open={!!selectedRtv}
          title={`Supplier Return Details — ${selectedRtv.rtvNumber}`}
          onClose={() => setSelectedRtv(null)}
          size="max-w-[640px]"
        >
          <div className="space-y-5 text-text-primary type-body">
            {/* Status Summary Banner */}
            <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold type-section-title text-text-primary">
                  Return to Vendor
                </div>
                <p className="text-text-muted mt-0.5 type-caption">
                  Physical return documentation and quarantine disposition record.
                </p>
              </div>
              <StatusBadge status={selectedRtv.status} />
            </div>

            {/* Traceability Grid */}
            <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="type-caption font-medium text-text-muted">Return to Vendor No.</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedRtv.rtvNumber}</div>
              </div>
              <div>
                <div className="type-caption font-medium text-text-muted">Source Discrepancy</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedRtv.discrepancyNumber || "Direct"}</div>
              </div>
              <div>
                <div className="type-caption font-medium text-text-muted">Source Goods Receipt Note</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedRtv.grnNumber || "—"}</div>
              </div>
              <div>
                <div className="type-caption font-medium text-text-muted">Purchase Order</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{selectedRtv.poNumber || "—"}</div>
              </div>
            </div>

            {/* Item & Return Details */}
            <div className="border border-divider rounded-control p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="type-caption font-medium text-text-muted">Item Description</div>
                  <div className="font-semibold type-body text-text-primary mt-0.5">{selectedRtv.itemName || `Item #${selectedRtv.itemId}`}</div>
                </div>
                <div className="text-right">
                  <div className="type-caption font-medium text-text-muted">Quantity to Return</div>
                  <div className="font-semibold type-body text-text-primary mt-0.5">
                    {(selectedRtv.returnedQuantity ?? selectedRtv.quantityReturned ?? 0).toLocaleString()} {selectedRtv.uomName || "Units"}
                  </div>
                </div>
              </div>

              <div className="border-t border-divider pt-3">
                <div className="type-caption font-medium text-text-muted mb-1">Supplier</div>
                <div className="type-body font-semibold text-text-primary">{selectedRtv.supplierName || `Supplier #${selectedRtv.supplierId}`}</div>
              </div>

              <div className="border-t border-divider pt-3">
                <div className="type-caption font-medium text-text-muted mb-1">Reason for Return</div>
                <div className="bg-surface p-3 rounded-control border border-divider type-body text-text-primary">
                  {selectedRtv.returnReason || (selectedRtv as { reason?: string }).reason || "Defective stock"}
                </div>
              </div>

              {selectedRtv.creditNoteNumber && (
                <div className="border-t border-divider pt-3">
                  <div className="type-caption font-medium text-text-muted mb-1">Supplier Credit Note</div>
                  <div className="bg-surface-secondary/40 p-2.5 rounded-control type-body text-text-primary">
                    {selectedRtv.creditNoteNumber}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Lower right corner */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-divider mt-4">
              <ModalNativeCloseButton
                fallbackOnClose={() => setSelectedRtv(null)}
                className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary transition-colors shadow-card cursor-pointer"
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
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary transition-colors disabled:opacity-50 cursor-pointer"
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
                    className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 transition-colors shadow-card disabled:opacity-50 cursor-pointer"
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
                  className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 transition-colors shadow-card disabled:opacity-50 cursor-pointer"
                >
                  Dispatch Shipment
                </button>
              )}
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* APPROVE RTV MODAL */}
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

      {/* REJECT RTV MODAL */}
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
          <label className="type-caption font-semibold text-text-primary block mb-1.5">
            Rejection Reason <span className="text-badge-danger-text">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Explain why this supplier return request is being rejected..."
            value={rejectionReason}
            onChange={(e) => {
              setRejectionReason(e.target.value);
              if (rejectionError) setRejectionError(null);
            }}
            className={`w-full bg-surface border ${
              rejectionError ? "!border-badge-danger-border focus:!border-badge-danger-border" : "border-divider"
            } rounded-control p-3 type-caption text-text-primary resize-none focus:outline-none focus:border-border-focus`}
          />
          {rejectionError && (
            <p className="mt-1.5 type-caption font-medium text-badge-danger-text">
              {rejectionError}
            </p>
          )}
        </div>
      </ActionConfirmModal>

      {/* DISPATCH RTV MODAL */}
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
          <label className="type-caption font-semibold text-text-primary block mb-1.5">
            Supplier Credit Note / Settlement Ref (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. CN-2026-9901"
            value={creditNoteNumber}
            onChange={(e) => setCreditNoteNumber(e.target.value)}
            className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-caption text-text-primary focus:outline-none focus:border-border-focus"
          />
        </div>
      </ActionConfirmModal>
    </div>
  );
}
