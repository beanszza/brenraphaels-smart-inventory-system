"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState } from "react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Discrepancy } from "./types";
import { HR_EMPLOYEES } from "@/lib/employees";

interface DiscrepancyDetailsModalProps {
  discrepancy: Discrepancy | null;
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export default function DiscrepancyDetailsModal({
  discrepancy,
  open,
  onClose,
  onResolved,
}: DiscrepancyDetailsModalProps) {
  const [activeForm, setActiveForm] = useState<"none" | "loss" | "rtv" | "resolve">("none");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Loss Report form state
  const [lossReason, setLossReason] = useState("");
  const [lossNotes, setLossNotes] = useState("");
  const [lossAuthorisedBy, setLossAuthorisedBy] = useState("Warehouse QA Manager");

  // RTV form state
  const [rtvReason, setRtvReason] = useState("");
  const [rtvCarrier, setRtvCarrier] = useState("");
  const [rtvNotes, setRtvNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    kind: "direct" | "loss" | "rtv";
    resolutionType?: string;
    defaultNotes?: string;
    title: string;
    description: string;
    confirmText: string;
  } | null>(null);

  if (!discrepancy) return null;

  const isResolved = discrepancy.status === "Resolved" || discrepancy.status === "Closed";

  const handleResolveDirect = async (type: string, defaultNotes: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await receiving.resolveDiscrepancy(discrepancy.discrepancyId, {
        resolutionType: type,
        resolutionNotes: resolutionNotes || defaultNotes,
      });
      if (res.data?.success) {
        onResolved();
        onClose();
      } else {
        setError(res.data?.message || "Failed to resolve discrepancy.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || "Failed to resolve discrepancy.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLossReport = async () => {
    if (!lossReason.trim()) {
      setError("Please state the reason for writing off as a loss.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await receiving.resolveAsLoss(discrepancy.discrepancyId, {
        reason: lossReason.trim(),
        notes: lossNotes.trim() || undefined,
      });
      if (res.data?.success) {
        onResolved();
        onClose();
      } else {
        setError(res.data?.message || "Failed to create Loss Report.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || "Failed to create Loss Report.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRtv = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await receiving.resolveAsReturn(discrepancy.discrepancyId, {
        reason: rtvReason.trim() || `Return arising from Discrepancy ${discrepancy.discrepancyNumber}`,
        carrier: rtvCarrier.trim() || undefined,
        notes: rtvNotes.trim() || undefined,
      });
      if (res.data?.success) {
        onResolved();
        onClose();
      } else {
        setError(res.data?.message || "Failed to create Return to Supplier.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || "Failed to create Return to Supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title={`Discrepancy Report - ${discrepancy.discrepancyNumber}`}
      onClose={onClose}
      size="max-w-[640px]"
    >
      <div className="space-y-6 text-text-primary">
        {error && (
          <div role="alert" className="bg-badge-danger-bg border border-badge-danger-border text-badge-danger-text type-caption rounded-control p-3">
            {error}
          </div>
        )}

        {/* TRACEABILITY BANNER */}
        <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <div className="type-caption font-medium text-text-muted">Type</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">
              {discrepancy.discrepancyType === "PartialShort"
                ? "Partial / Short Delivery"
                : discrepancy.discrepancyType === "OverSupply"
                ? "Over Supply"
                : "Rejected in QA"}
            </div>
          </div>
          <div>
            <div className="type-caption font-medium text-text-muted">Source Goods Receipt Note</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{discrepancy.grnNumber}</div>
          </div>
          <div>
            <div className="type-caption font-medium text-text-muted">Purchase Order</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{discrepancy.poNumber}</div>
          </div>
          {discrepancy.prNumber && discrepancy.prNumber !== "—" && (
            <div>
              <div className="type-caption font-medium text-text-muted">Product Requisition</div>
              <div className="type-body font-semibold text-text-primary mt-0.5">{discrepancy.prNumber}</div>
            </div>
          )}
          {discrepancy.supplierName && discrepancy.supplierName !== "—" && (
            <div>
              <div className="type-caption font-medium text-text-muted">Supplier</div>
              <div className="type-body font-semibold text-text-primary mt-0.5 truncate" title={discrepancy.supplierName}>{discrepancy.supplierName}</div>
            </div>
          )}
          <div>
            <div className="type-caption font-medium text-text-muted">Status</div>
            <div className="mt-1">
              <StatusBadge status={discrepancy.status} />
            </div>
          </div>
        </div>

        {/* QUANTITY & ITEM BREAKDOWN */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface border border-divider rounded-control p-4">
          <div>
            <div className="type-caption font-medium text-text-muted">Item Name</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{discrepancy.itemName}</div>
          </div>
          <div>
            <div className="type-caption font-medium text-text-muted">Purchase Order Quantity</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{discrepancy.orderedQuantity.toLocaleString()}</div>
          </div>
          <div>
            <div className="type-caption font-medium text-text-muted">Actual Received Qty</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{discrepancy.currentReceivedQty.toLocaleString()}</div>
          </div>
          <div>
            <div className="type-caption font-medium text-text-muted">Discrepancy Quantity</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">
              {discrepancy.discrepancyType === "OverSupply" ? "+" : "-"}
              {discrepancy.discrepancyQuantity.toLocaleString()}
            </div>
          </div>
        </div>

        {/* RESOLUTION HISTORY / STATUS */}
        {isResolved ? (
          <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 space-y-2 type-body">
            <div className="type-overline uppercase text-text-muted">Resolution Details</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="type-caption font-medium text-text-muted block">Action Taken</span>
                <span className="type-body font-semibold text-text-primary">{discrepancy.resolutionType || "Resolved"}</span>
              </div>
              <div>
                <span className="type-caption font-medium text-text-muted block">Resolved By</span>
                <span className="type-body font-semibold text-text-primary">{discrepancy.resolvedBy || "System"}</span>
              </div>
              <div>
                <span className="type-caption font-medium text-text-muted block">Resolved At</span>
                <span className="type-body font-semibold text-text-primary">
                  {discrepancy.resolvedAt ? new Date(discrepancy.resolvedAt).toLocaleString() : "—"}
                </span>
              </div>
            </div>
            {discrepancy.lossReportNumber && (
              <div className="pt-2 type-body text-text-primary">
                <strong>Loss report created</strong>
              </div>
            )}
            {discrepancy.rtvNumber && (
              <div className="pt-2 type-body text-text-primary">
                Return to Vendor: <strong>{discrepancy.rtvNumber}</strong>
              </div>
            )}
            {discrepancy.resolutionNotes && (
              <div className="type-caption text-text-muted pt-1 italic">"{discrepancy.resolutionNotes}"</div>
            )}
          </div>
        ) : activeForm !== "none" ? (
          /* ACTION FORM FOR OPEN DISCREPANCY */
          <div className="border-t border-divider pt-4 space-y-4">

            {/* FORM: CREATE LOSS REPORT */}
            {activeForm === "loss" && (
              <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 space-y-3">
                <div className="type-overline uppercase text-text-muted">
                  Generate Loss Report
                </div>
                <p className="type-caption text-text-muted">
                  Goods will be permanently written off via Stock Ledger disposal. Quantity removed from inventory.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="type-caption font-semibold text-text-primary block mb-1">Reason for Write-Off *</label>
                    <input
                      type="text"
                      placeholder="e.g. Supplier confirmed cannot supply balance / Goods destroyed"
                      value={lossReason}
                      onChange={(e) => setLossReason(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="type-caption font-semibold text-text-primary block mb-1">Authorised By *</label>
                    <select
                      value={lossAuthorisedBy}
                      onChange={(e) => setLossAuthorisedBy(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary focus:outline-none focus:border-border-focus"
                    >
                      {HR_EMPLOYEES.map((employee) => (
                        <option key={employee} value={employee}>{employee}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="type-caption font-semibold text-text-primary block mb-1">Additional Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes or reference document"
                      value={lossNotes}
                      onChange={(e) => setLossNotes(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    disabled={submitting}
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!lossReason.trim()) {
                        setError("Please state the reason for writing off as a loss.");
                        return;
                      }
                      setError(null);
                      setPendingConfirm({
                        kind: "loss",
                        title: "Confirm Loss Report",
                        description: `Are you sure you want to generate a Loss Report and permanently write off ${discrepancy.discrepancyQuantity.toLocaleString()} units of ${discrepancy.itemName}?`,
                        confirmText: "Confirm Loss Report",
                      });
                    }}
                    disabled={submitting}
                    className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
                  >
                    {submitting ? "Writing Off..." : "Confirm Loss Report"}
                  </button>
                </div>
              </div>
            )}

            {/* FORM: RETURN TO SUPPLIER */}
            {activeForm === "rtv" && (
              <div className="bg-surface-secondary/40 border border-divider rounded-control p-4 space-y-3">
                <div className="type-overline uppercase text-text-muted">
                  Request Return to Supplier
                </div>
                <p className="type-caption text-text-muted">
                  Creates an official return shipment request submitted for administrator approval prior to dispatch.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="type-caption font-semibold text-text-primary block mb-1">Reason for Return</label>
                    <input
                      type="text"
                      placeholder="e.g. Failed incoming Quality Assurance specifications / Rejected lot"
                      value={rtvReason}
                      onChange={(e) => setRtvReason(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="type-caption font-semibold text-text-primary block mb-1">Carrier / Courier (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. DHL / Supplier Pickup"
                      value={rtvCarrier}
                      onChange={(e) => setRtvCarrier(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="type-caption font-semibold text-text-primary block mb-1">Approval Request Notes</label>
                    <input
                      type="text"
                      placeholder="Notes for administrator approval or vendor RMA number"
                      value={rtvNotes}
                      onChange={(e) => setRtvNotes(e.target.value)}
                      className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    disabled={submitting}
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirm({
                        kind: "rtv",
                        title: "Submit Return Request",
                        description: `Are you sure you want to submit a Return to Supplier (RTV) request for ${discrepancy.discrepancyQuantity.toLocaleString()} units of ${discrepancy.itemName} for administrator approval?`,
                        confirmText: "Confirm & Submit",
                      })
                    }
                    disabled={submitting}
                    className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
                  >
                    {submitting ? "Submitting..." : "Submit Return Request"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* FOOTER ACTIONS - All buttons in lower right corner */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-divider mt-4">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={submitting}
            className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Close
          </ModalNativeCloseButton>

          {!isResolved && activeForm === "none" && (
            <>
              {discrepancy.discrepancyType === "PartialShort" && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setPendingConfirm({
                        kind: "direct",
                        resolutionType: "NewDelivery",
                        defaultNotes: "Supplier notified to deliver remaining shortage on next shipment.",
                        title: "Wait for Next Delivery",
                        description: `Are you sure you want to mark discrepancy ${discrepancy.discrepancyNumber} as awaiting the remaining ${discrepancy.discrepancyQuantity.toLocaleString()} units on the next supplier delivery?`,
                        confirmText: "Confirm Resolution",
                      })
                    }
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Wait for Next Delivery
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setPendingConfirm({
                        kind: "direct",
                        resolutionType: "CloseRemaining",
                        defaultNotes: "Accepted partial delivery. Remaining shortage is closed and not expected.",
                        title: "Close Remaining Shortage",
                        description: `Are you sure you want to accept this partial delivery and close the remaining shortage of ${discrepancy.discrepancyQuantity.toLocaleString()} units for ${discrepancy.itemName}?`,
                        confirmText: "Confirm & Close",
                      })
                    }
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Close Remaining
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("loss")}
                    className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
                  >
                    Create Loss Report
                  </button>
                </>
              )}

              {discrepancy.discrepancyType === "Rejected" && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setPendingConfirm({
                        kind: "direct",
                        resolutionType: "NewDelivery",
                        defaultNotes: "Supplier notified to deliver replacement units on next shipment.",
                        title: "Wait for Replacement Delivery",
                        description: `Are you sure you want to resolve discrepancy ${discrepancy.discrepancyNumber} by awaiting ${discrepancy.discrepancyQuantity.toLocaleString()} replacement units on the next shipment?`,
                        confirmText: "Confirm Resolution",
                      })
                    }
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Wait for Replacement Delivery
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("loss")}
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Create Loss Report
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("rtv")}
                    className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
                  >
                    Request Return to Supplier
                  </button>
                </>
              )}

              {discrepancy.discrepancyType === "OverSupply" && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setPendingConfirm({
                        kind: "direct",
                        resolutionType: "KeepWithCredit",
                        defaultNotes: "Accepted excess inventory; credit note or adjusted invoice applied.",
                        title: "Keep Oversupply (With Credit Note)",
                        description: `Are you sure you want to keep the excess ${discrepancy.discrepancyQuantity.toLocaleString()} units of ${discrepancy.itemName} with a supplier credit note or invoice adjustment?`,
                        confirmText: "Confirm Resolution",
                      })
                    }
                    className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Keep (With Credit Note)
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("rtv")}
                    className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
                  >
                    Request Return to Supplier
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ActionConfirmModal
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || "Confirm Action"}
        subtitle={`Discrepancy No: ${discrepancy.discrepancyNumber} • GRN No: ${discrepancy.grnNumber}`}
        description={pendingConfirm?.description || ""}
        confirmText={pendingConfirm?.confirmText || "Confirm"}
        loading={submitting}
        loadingText="Processing..."
        onConfirm={async () => {
          if (!pendingConfirm) return;
          if (pendingConfirm.kind === "direct" && pendingConfirm.resolutionType) {
            await handleResolveDirect(pendingConfirm.resolutionType, pendingConfirm.defaultNotes || "");
          } else if (pendingConfirm.kind === "loss") {
            await handleCreateLossReport();
          } else if (pendingConfirm.kind === "rtv") {
            await handleCreateRtv();
          }
          setPendingConfirm(null);
        }}
        onClose={() => setPendingConfirm(null)}
      />
    </ModalWrapper>
  );
}
