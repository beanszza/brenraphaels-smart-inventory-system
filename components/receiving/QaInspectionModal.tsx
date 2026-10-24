"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { QAInspection } from "./types";

interface QaInspectionModalProps {
  inspection: QAInspection | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemRow {
  inspectionItemId: number;
  itemId: number;
  itemName: string;
  categoryName?: string;
  lotId?: number;
  lotCode?: string;
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  concessionQuantity: number;
  defectReason: string;
  notes: string;
  checks: Record<string, boolean>;
}

const rawMaterialChecks = [
  { id: "identity", label: "Material identity and approved specification match" },
  { id: "quantity", label: "Quantity, unit of measure, and pack size verified" },
  { id: "condition", label: "Freshness, appearance, packaging, and physical condition acceptable" },
  { id: "traceability", label: "Lot, label, manufacture date, and expiry checked" },
  { id: "safety", label: "Cleanliness, contamination, allergen, and foreign matter check passed" },
  { id: "documents", label: "COA, certificate, temperature, and storage requirements reviewed" },
];

const toolAndSupplyChecks = [
  { id: "identity", label: "Item identity, model, size, and approved specification match" },
  { id: "quantity", label: "Quantity, unit of measure, and pack count verified" },
  { id: "condition", label: "Item is undamaged, clean, and fit for use" },
  { id: "packaging", label: "Packaging and seals are intact where applicable" },
  { id: "safety", label: "Safety, hygiene, and contact-use requirements checked" },
  { id: "documents", label: "Certificate, warranty, expiry, or supplier document reviewed" },
];

export default function QaInspectionModal({ inspection, open, onClose, onSuccess }: QaInspectionModalProps) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [overallNotes, setOverallNotes] = useState("");
  const [verificationChoice, setVerificationChoice] = useState("");
  const [inspectionBasis, setInspectionBasis] = useState("");
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);

  const isReadOnly = inspection?.status !== "Pending";

  useEffect(() => {
    if (open && inspection) {
      setError(null);
      setOverallNotes(inspection.overallNotes || "");
      const basis = inspection.overallNotes?.match(/^QA BASIS:\s*(.+?)(?:\n|$)/)?.[1] || "";
      setInspectionBasis(basis);
      const rows: ItemRow[] = (inspection.items || []).map((i) => ({
        inspectionItemId: i.inspectionItemId,
        itemId: i.itemId,
        itemName: i.itemName,
        categoryName: i.categoryName,
        lotId: i.lotId,
        lotCode: i.lotCode,
        deliveredQuantity: i.deliveredQuantity,
        // Default to accepted = delivered if pending, or existing values if already inspected
        acceptedQuantity: inspection.status === "Pending" ? i.deliveredQuantity : i.acceptedQuantity,
        rejectedQuantity: i.rejectedQuantity || 0,
        concessionQuantity: i.concessionQuantity || 0,
        defectReason: i.defectReason || "",
        notes: i.notes || "",
        checks: Object.fromEntries([...rawMaterialChecks, ...toolAndSupplyChecks].map((check) => [check.id, inspection.status !== "Pending"])),
      }));
      setItems(rows);
      setExpandedItems(Object.fromEntries(rows.map((row, index) => [row.inspectionItemId, index === 0])));
    }
  }, [open, inspection]);

  if (!inspection) return null;

  const getChecks = (item: ItemRow) => {
    const isToolOrSupply = /tool|suppl/i.test(item.categoryName || "");
    return isToolOrSupply ? toolAndSupplyChecks : rawMaterialChecks;
  };

  const updateItem = (index: number, field: keyof ItemRow, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const setItemAccepted = (index: number, acceptedVal: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const delivered = copy[index].deliveredQuantity;
      const acc = Math.max(0, Math.min(delivered, acceptedVal));
      copy[index] = {
        ...copy[index],
        acceptedQuantity: acc,
        rejectedQuantity: delivered - acc,
      };
      return copy;
    });
  };

  const setItemRejected = (index: number, rejectedVal: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const delivered = copy[index].deliveredQuantity;
      const rej = Math.max(0, Math.min(delivered, rejectedVal));
      copy[index] = {
        ...copy[index],
        rejectedQuantity: rej,
        acceptedQuantity: delivered - rej,
      };
      return copy;
    });
  };

  // Validation: For each item, accepted + rejected must equal delivered
  const mismatch = items.some(
    (i) => Number(i.acceptedQuantity) + Number(i.rejectedQuantity) !== Number(i.deliveredQuantity)
  );
  const missingDefectReasons = items.some(
    (item) => Number(item.rejectedQuantity) > 0 && !item.defectReason.trim()
  );

  const isAllAccepted = items.length > 0 && items.every((i) => Number(i.acceptedQuantity) === Number(i.deliveredQuantity));
  const isAllRejected = items.length > 0 && items.every((i) => Number(i.rejectedQuantity) === Number(i.deliveredQuantity));

  useEffect(() => {
    if (isAllAccepted) {
      setVerificationChoice("All Accepted");
    } else if (isAllRejected) {
      setVerificationChoice("All Rejected");
    }
  }, [isAllAccepted, isAllRejected]);

  const handleSubmit = () => {
    if (mismatch) {
      setError("Every item's Accepted + Rejected quantity must equal Delivered quantity.");
      return;
    }
    if (missingDefectReasons) {
      setError("Select a defect reason for every item with rejected quantity.");
      return;
    }
    if (!verificationChoice) {
      setError("Please select a Verification Choice.");
      return;
    }
    setConfirmModal(true);
  };

  const executeSubmit = async () => {

    setSubmitting(true);
    setError(null);

    const payload = {
      overallNotes: overallNotes.trim() || undefined,
      items: items.map((i) => ({
        inspectionItemId: i.inspectionItemId,
        itemId: i.itemId,
        lotId: i.lotId,
        deliveredQuantity: Number(i.deliveredQuantity),
        acceptedQuantity: Number(i.acceptedQuantity),
        rejectedQuantity: Number(i.rejectedQuantity),
        concessionQuantity: Number(i.concessionQuantity),
        defectReason: i.defectReason.trim() || undefined,
        notes: [
          `[QA CHECKS: ${getChecks(i).filter((check) => i.checks[check.id]).map((check) => check.id).join(", ") || "none recorded"}]`,
          i.notes.trim(),
        ].filter(Boolean).join(" ") || undefined,
      })),
    };

    const inspectionNotes = [
      inspectionBasis.trim() ? `QA BASIS: ${inspectionBasis.trim()}` : "",
      `VERIFICATION: ${verificationChoice}`,
      overallNotes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await receiving.completeInspection(inspection.inspectionId, {
        ...payload,
        overallNotes: inspectionNotes || undefined,
      });
      if (res.data?.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.data?.message || "Failed to complete Quality Assurance inspection.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to complete Quality Assurance inspection.");
    } finally {
      setSubmitting(false);
      setConfirmModal(false);
    }
  };

  const defectReasons = [
    "Damaged Packaging",
    "Wrong Item",
    "Sub-standard Quality",
    "Expired / Short Shelf Life",
    "Contaminated / Foreign Matter",
    "Temperature Abuse",
    "Labeling Error",
    "Other",
  ];

  return (
    <ModalWrapper
      open={open}
      title={`${isReadOnly ? "View" : "Complete"} Quality Inspection - ${inspection.inspectionNumber}`}
      onClose={onClose}
      size="max-w-5xl"
    >
      <div className="space-y-6 text-foreground">
        {error && (
          <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl p-3">
            {error}
          </div>
        )}

        {/* HEADER SUMMARY */}
        <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inspection #</div>
            <div className="text-sm font-semibold mt-0.5">{inspection.inspectionNumber}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Goods Receipt Note Reference</div>
            <div className="text-sm font-semibold mt-0.5">{inspection.referenceNumber || inspection.grnNumber}</div>
          </div>
          {inspection.poNumber && inspection.poNumber !== "—" && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Purchase Order</div>
              <div className="text-sm font-semibold mt-0.5">{inspection.poNumber}</div>
            </div>
          )}
          {inspection.prNumber && inspection.prNumber !== "—" && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Product Requisition</div>
              <div className="text-sm font-semibold mt-0.5">{inspection.prNumber}</div>
            </div>
          )}
          {inspection.supplierName && inspection.supplierName !== "—" && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Supplier</div>
              <div className="text-sm font-semibold mt-0.5 truncate" title={inspection.supplierName}>{inspection.supplierName}</div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
            <div className="text-sm font-semibold mt-0.5">{inspection.status}</div>
          </div>
        </div>

        {/* ITEMS INSPECTION ACCORDIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Received Items
            </span>
            <span className="text-xs text-muted-foreground">
              Open each item to complete its checklist and disposition
            </span>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const checks = getChecks(item);
              const itemComplete = checks.every((check) => item.checks[check.id]) &&
                Number(item.acceptedQuantity) + Number(item.rejectedQuantity) === Number(item.deliveredQuantity) &&
                (Number(item.rejectedQuantity) === 0 || Boolean(item.defectReason.trim()));
              const expanded = expandedItems[item.inspectionItemId];
              return (
                <div key={item.inspectionItemId} className="border border-border rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setExpandedItems((current) => ({ ...current, [item.inspectionItemId]: !expanded }))} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-muted/20 hover:bg-muted/40 transition-colors">
                    <span className="flex items-center gap-3 min-w-0">
                      {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate text-foreground">{item.itemName}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                            {item.categoryName || "Raw Materials"}
                          </span>
                          {item.lotCode && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                              Lot: {item.lotCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Protocol: {getChecks(item) === toolAndSupplyChecks ? "Tools & Supplies Verification" : "Food / Raw Material Specification"}
                        </div>
                      </div>
                    </span>
                    <span className={`text-[11px] font-semibold whitespace-nowrap ${itemComplete ? "text-emerald-600" : "text-muted-foreground"}`}>{itemComplete ? "Ready" : "Incomplete"}</span>
                  </button>
                  {expanded && <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><div className="text-muted-foreground">Delivered</div><div className="font-mono font-semibold">{item.deliveredQuantity.toLocaleString()}</div></div>
                      <div><div className="text-muted-foreground">Passed quantity</div>{isReadOnly ? <div className="font-mono font-semibold text-emerald-600">{item.acceptedQuantity}</div> : <input type="number" min="0" max={item.deliveredQuantity} step="any" value={item.acceptedQuantity} onChange={(e) => setItemAccepted(idx, Number(e.target.value))} className="w-full bg-card border border-border rounded-lg px-2 py-1 font-mono" />}</div>
                      <div><div className="text-muted-foreground">Rejected quantity</div>{isReadOnly ? <div className="font-mono font-semibold text-destructive">{item.rejectedQuantity}</div> : <input type="number" min="0" max={item.deliveredQuantity} step="any" value={item.rejectedQuantity} onChange={(e) => setItemRejected(idx, Number(e.target.value))} className="w-full bg-card border border-border rounded-lg px-2 py-1 font-mono" />}</div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {checks.map((check) => <label key={check.id} className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={item.checks[check.id]} onChange={(e) => updateItem(idx, "checks", { ...item.checks, [check.id]: e.target.checked })} disabled={isReadOnly} className="mt-0.5" /><span>{check.label}</span></label>)}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>{Number(item.rejectedQuantity) > 0 && (isReadOnly ? <div className="text-xs text-muted-foreground">Defect: {item.defectReason || "—"}</div> : <select value={item.defectReason} onChange={(e) => updateItem(idx, "defectReason", e.target.value)} className="w-full bg-card border border-border rounded-lg px-2 py-2 text-xs"><option value="">Select defect reason</option>{defectReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select>)}</div>
                      {isReadOnly ? <div className="text-xs text-muted-foreground">{item.notes || "No item notes."}</div> : <input type="text" placeholder="Optional item notes" value={item.notes} onChange={(e) => updateItem(idx, "notes", e.target.value)} className="w-full bg-card border border-border rounded-lg px-2 py-2 text-xs" />}
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* INSPECTION BASIS */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide block">
            Inspection Basis {!isReadOnly && "(Optional)"}
          </label>
          {isReadOnly ? (
            <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs text-muted-foreground">
              {inspectionBasis || "Recorded in the inspection summary."}
            </div>
          ) : (
            <input
              type="text"
              placeholder="e.g. Approved raw-material specification RM-014, COA no. 8831, receiving temperature 4 C"
              value={inspectionBasis}
              onChange={(e) => setInspectionBasis(e.target.value)}
              className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          )}
        </div>

        {/* VERIFICATION CHOICE & OVERALL NOTES */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block">
              Verification Choice <span className="text-destructive">*</span>
            </label>
            {isReadOnly ? (
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs font-medium text-foreground">
                {inspection?.overallNotes?.match(/VERIFICATION:\s*(.*?)(?:\n|$)/)?.[1] || "—"}
              </div>
            ) : (
              <select
                value={verificationChoice}
                onChange={(e) => setVerificationChoice(e.target.value)}
                className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <option value="">Select a Verification Reason...</option>
                <optgroup label="Positive Outcomes (Accepted)">
                  <option value="All Accepted">All Accepted</option>
                  <option value="Partial Accept - Acceptable Quality">Partial Accept - Acceptable Quality</option>
                  <option value="Partial Accept - Condition Satisfactory">Partial Accept - Condition Satisfactory</option>
                </optgroup>
                <optgroup label="Negative Outcomes (Rejected)">
                  <option value="All Rejected">All Rejected</option>
                  <option value="Rejected - Quality Issues">Rejected - Quality Issues</option>
                  <option value="Rejected - Packaging Issues">Rejected - Packaging Issues</option>
                  <option value="Rejected - Documentation Issues">Rejected - Documentation Issues</option>
                </optgroup>
              </select>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block">
              Additional Remarks (Optional)
            </label>
            {isReadOnly ? (
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs text-muted-foreground">
                {overallNotes.replace(/VERIFICATION:\s*.*?(?:\n|$)/, "") || "No additional remarks."}
              </div>
            ) : (
              <textarea
                rows={2}
                placeholder="e.g. Visual and laboratory testing confirmed compliant specifications. 10 kg rejected due to moisture damage."
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-border pt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {mismatch && (
              <span className="text-destructive font-semibold">
                Quantities do not balance! Accepted + Rejected must equal Delivered.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-xl border border-border bg-card text-foreground px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || mismatch || missingDefectReasons}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {submitting ? "Submitting..." : "Complete Quality Assurance Inspection"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Review Modal Portal */}
      {confirmModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background rounded-2xl shadow-xl w-full max-w-[500px] border border-border overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Complete Quality Assurance Inspection
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You are about to finalize this Quality Assurance Inspection.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-2 border border-border">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Inspection #:</span>
                    <span className="font-semibold text-foreground">
                      {inspection?.inspectionNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {items.length} item(s)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Action:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      Finalize & Save
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(false)}
                    disabled={submitting}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={executeSubmit}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Confirm & Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ModalWrapper>
  );
}
