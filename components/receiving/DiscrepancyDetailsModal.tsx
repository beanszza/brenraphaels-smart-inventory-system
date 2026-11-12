"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState } from "react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
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
  const [resolutionType, setResolutionType] = useState("");
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to resolve discrepancy.");
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create Loss Report.");
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create Return to Supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title={`Discrepancy Report - ${discrepancy.discrepancyNumber}`}
      onClose={onClose}
      size="max-w-4xl"
    >
      <div className="space-y-6 text-foreground">
        {error && (
          <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl p-3">
            {error}
          </div>
        )}

        {/* TRACEABILITY BANNER */}
        <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Type</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">
              {discrepancy.discrepancyType === "PartialShort"
                ? "Partial / Short Delivery"
                : discrepancy.discrepancyType === "OverSupply"
                ? "Over Supply"
                : "Rejected in QA"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Source Goods Receipt Note</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">{discrepancy.grnNumber}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Purchase Order</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">{discrepancy.poNumber}</div>
          </div>
          {discrepancy.prNumber && discrepancy.prNumber !== "—" && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Product Requisition</div>
              <div className="text-sm font-semibold text-foreground mt-0.5">{discrepancy.prNumber}</div>
            </div>
          )}
          {discrepancy.supplierName && discrepancy.supplierName !== "—" && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Supplier</div>
              <div className="text-sm font-semibold text-foreground mt-0.5 truncate" title={discrepancy.supplierName}>{discrepancy.supplierName}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-muted-foreground">Status</div>
            <div className="mt-1">
              <StatusBadge status={discrepancy.status} />
            </div>
          </div>
        </div>

        {/* QUANTITY & ITEM BREAKDOWN */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-card border border-border rounded-xl p-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Item Name</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">{discrepancy.itemName}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Purchase Order Quantity</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">{discrepancy.orderedQuantity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Actual Received Qty</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">{discrepancy.currentReceivedQty.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Discrepancy Quantity</div>
            <div className="text-sm font-semibold text-foreground mt-0.5">
              {discrepancy.discrepancyType === "OverSupply" ? "+" : "-"}
              {discrepancy.discrepancyQuantity.toLocaleString()}
            </div>
          </div>
        </div>

        {/* RESOLUTION HISTORY / STATUS */}
        {isResolved ? (
          <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2 text-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resolution Details</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Action Taken</span>
                <span className="text-sm font-semibold text-foreground">{discrepancy.resolutionType || "Resolved"}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Resolved By</span>
                <span className="text-sm font-semibold text-foreground">{discrepancy.resolvedBy || "System"}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Resolved At</span>
                <span className="text-sm font-semibold text-foreground">
                  {discrepancy.resolvedAt ? new Date(discrepancy.resolvedAt).toLocaleString() : "—"}
                </span>
              </div>
            </div>
            {discrepancy.lossReportNumber && (
              <div className="pt-2 text-sm text-foreground">
                <strong>Loss report created</strong>
              </div>
            )}
            {discrepancy.rtvNumber && (
              <div className="pt-2 text-sm text-foreground">
                Return to Vendor: <strong>{discrepancy.rtvNumber}</strong>
              </div>
            )}
            {discrepancy.resolutionNotes && (
              <div className="text-xs text-muted-foreground pt-1 italic">"{discrepancy.resolutionNotes}"</div>
            )}
          </div>
        ) : activeForm !== "none" ? (
          /* ACTION FORM FOR OPEN DISCREPANCY */
          <div className="border-t border-border pt-4 space-y-4">

            {/* FORM: CREATE LOSS REPORT */}
            {activeForm === "loss" && (
              <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Generate Loss Report
                </div>
                <p className="text-xs text-muted-foreground">
                  Goods will be permanently written off via Stock Ledger disposal. Quantity removed from inventory.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Reason for Write-Off *</label>
                    <input
                      type="text"
                      placeholder="e.g. Supplier confirmed cannot supply balance / Goods destroyed"
                      value={lossReason}
                      onChange={(e) => setLossReason(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Authorised By *</label>
                    <select
                      value={lossAuthorisedBy}
                      onChange={(e) => setLossAuthorisedBy(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                    >
                      {HR_EMPLOYEES.map((employee) => (
                        <option key={employee} value={employee}>{employee}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Additional Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes or reference document"
                      value={lossNotes}
                      onChange={(e) => setLossNotes(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    disabled={submitting}
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateLossReport}
                    disabled={submitting}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {submitting ? "Writing Off..." : "Confirm Loss Report"}
                  </button>
                </div>
              </div>
            )}

            {/* FORM: RETURN TO SUPPLIER */}
            {activeForm === "rtv" && (
              <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Request Return to Supplier
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates an official return shipment request submitted for administrator approval prior to dispatch.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Reason for Return</label>
                    <input
                      type="text"
                      placeholder="e.g. Failed incoming Quality Assurance specifications / Rejected lot"
                      value={rtvReason}
                      onChange={(e) => setRtvReason(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Carrier / Courier (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. DHL / Supplier Pickup"
                      value={rtvCarrier}
                      onChange={(e) => setRtvCarrier(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Approval Request Notes</label>
                    <input
                      type="text"
                      placeholder="Notes for administrator approval or vendor RMA number"
                      value={rtvNotes}
                      onChange={(e) => setRtvNotes(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-foreground focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm("none")}
                    disabled={submitting}
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateRtv}
                    disabled={submitting}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {submitting ? "Submitting..." : "Submit Return Request"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* FOOTER ACTIONS - All buttons in lower right corner */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border mt-4">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={submitting}
            className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                      handleResolveDirect(
                        "NewDelivery",
                        "Supplier notified to deliver remaining shortage on next shipment."
                      )
                    }
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Wait for Next Delivery
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      handleResolveDirect(
                        "CloseRemaining",
                        "Accepted partial delivery. Remaining shortage is closed and not expected."
                      )
                    }
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Close Remaining
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("loss")}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
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
                      handleResolveDirect(
                        "NewDelivery",
                        "Supplier notified to deliver replacement units on next shipment."
                      )
                    }
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Wait for Replacement Delivery
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("loss")}
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Create Loss Report
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("rtv")}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
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
                      handleResolveDirect(
                        "KeepWithCredit",
                        "Accepted excess inventory; credit note or adjusted invoice applied."
                      )
                    }
                    className="rounded-xl border border-border bg-card text-foreground px-5 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Keep (With Credit Note)
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setActiveForm("rtv")}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                  >
                    Request Return to Supplier
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
