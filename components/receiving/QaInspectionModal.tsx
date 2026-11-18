"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
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
  expiryDate?: string | null;
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

const nonExpiryChecks = [
  { id: "identity", label: "Item identity, model, size, and approved specification match" },
  { id: "quantity", label: "Quantity, unit of measure, and pack count verified" },
  { id: "condition", label: "Item is undamaged, clean, and fit for use" },
  { id: "packaging", label: "Packaging and seals are intact where applicable" },
  { id: "safety", label: "Safety, hygiene, and contact-use requirements checked" },
  { id: "documents", label: "Certificate, warranty, or supplier document reviewed" },
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
        expiryDate: i.expiryDate || null,
        lotId: i.lotId,
        lotCode: i.lotCode,
        deliveredQuantity: i.deliveredQuantity,
        // Default to accepted = delivered if pending, or existing values if already inspected
        acceptedQuantity: inspection.status === "Pending" ? i.deliveredQuantity : i.acceptedQuantity,
        rejectedQuantity: i.rejectedQuantity || 0,
        concessionQuantity: i.concessionQuantity || 0,
        defectReason: i.defectReason || "",
        notes: i.notes || "",
        checks: Object.fromEntries([...rawMaterialChecks, ...nonExpiryChecks].map((check) => [check.id, inspection.status !== "Pending"])),
      }));
      setItems(rows);
      setExpandedItems(Object.fromEntries(rows.map((row, index) => [row.inspectionItemId, index === 0])));
    }
  }, [open, inspection]);

  if (!inspection) return null;

  const getChecks = (item: ItemRow) => {
    return item.expiryDate ? rawMaterialChecks : nonExpiryChecks;
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
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : "Failed to complete Quality Assurance inspection.";
      setError(msg || "Failed to complete Quality Assurance inspection.");
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
      size="max-w-[640px]"
    >
      <div className="space-y-6 text-text-primary">
        {error && (
          <div role="alert" className="bg-status-red/10 border border-status-red/20 text-status-red type-caption rounded-control p-3">
            {error}
          </div>
        )}

        {/* HEADER SUMMARY */}
        <div className="bg-surface-muted/30 border border-divider rounded-control p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div>
            <div className="type-caption text-text-muted">Inspection #</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{inspection.inspectionNumber}</div>
          </div>
          <div>
            <div className="type-caption text-text-muted">Goods Receipt Note Reference</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{inspection.referenceNumber || inspection.grnNumber}</div>
          </div>
          {inspection.poNumber && inspection.poNumber !== "—" && (
            <div>
              <div className="type-caption text-text-muted">Purchase Order</div>
              <div className="type-body font-semibold text-text-primary mt-0.5">{inspection.poNumber}</div>
            </div>
          )}
          {inspection.prNumber && inspection.prNumber !== "—" && (
            <div>
              <div className="type-caption text-text-muted">Product Requisition</div>
              <div className="type-body font-semibold text-text-primary mt-0.5">{inspection.prNumber}</div>
            </div>
          )}
          {inspection.supplierName && inspection.supplierName !== "—" && (
            <div>
              <div className="type-caption text-text-muted">Supplier</div>
              <div className="type-body font-semibold text-text-primary mt-0.5 truncate" title={inspection.supplierName}>{inspection.supplierName}</div>
            </div>
          )}
          <div>
            <div className="type-caption text-text-muted">Status</div>
            <div className="type-body font-semibold text-text-primary mt-0.5">{inspection.status}</div>
          </div>
        </div>

        {/* ITEMS INSPECTION ACCORDIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="type-overline uppercase text-text-muted">
              Received Items
            </span>
            <span className="type-caption text-text-muted">
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
                <div key={item.inspectionItemId} className="border border-divider rounded-control overflow-hidden">
                  <button type="button" onClick={() => setExpandedItems((current) => ({ ...current, [item.inspectionItemId]: !expanded }))} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-surface-secondary/40 hover:bg-surface-secondary/70 transition-colors">
                    <span className="flex items-center gap-3 min-w-0">
                      {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-text-muted" /> : <ChevronRight className="w-4 h-4 shrink-0 text-text-muted" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="type-body font-semibold truncate text-text-primary">{item.itemName}</span>
                          <span className="type-caption font-medium px-2 py-0.5 rounded-control bg-surface-secondary text-text-primary border border-divider">
                            {item.categoryName || "Raw Materials"}
                          </span>
                          {item.expiryDate && (
                            <span className="type-caption text-text-muted bg-surface-secondary/60 px-2 py-0.5 rounded-control">
                              Exp: {new Date(item.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                          {item.lotCode && (
                            <span className="type-caption text-text-muted bg-surface-secondary/60 px-2 py-0.5 rounded-control">
                              Lot: {item.lotCode}
                            </span>
                          )}
                        </div>
                        <div className="type-caption text-text-muted mt-0.5">
                          Protocol: {getChecks(item) === nonExpiryChecks ? "Non-Expiry Verification" : "Food / Raw Material Specification"}
                        </div>
                      </div>
                    </span>
                    <span className={`type-caption font-semibold whitespace-nowrap ${itemComplete ? "text-badge-success-text" : "text-text-muted"}`}>{itemComplete ? "Ready" : "Incomplete"}</span>
                  </button>
                  {expanded && <div className="p-4 space-y-4 bg-surface">
                    <div className="grid grid-cols-3 gap-3">
                      <div><div className="type-caption font-medium text-text-muted">Delivered</div><div className="type-body font-semibold text-text-primary mt-0.5">{item.deliveredQuantity.toLocaleString()}</div></div>
                      <div><div className="type-caption font-medium text-text-muted mb-1">Passed quantity</div>{isReadOnly ? <div className="type-body font-semibold text-badge-success-text">{item.acceptedQuantity}</div> : <input type="number" min="0" max={item.deliveredQuantity} step="any" value={item.acceptedQuantity} onChange={(e) => setItemAccepted(idx, Number(e.target.value))} className="w-full bg-surface border border-divider rounded-control px-3 py-1.5 type-body text-text-primary focus:outline-none focus:border-border-focus" />}</div>
                      <div><div className="type-caption font-medium text-text-muted mb-1">Rejected quantity</div>{isReadOnly ? <div className="type-body font-semibold text-badge-danger-text">{item.rejectedQuantity}</div> : <input type="number" min="0" max={item.deliveredQuantity} step="any" value={item.rejectedQuantity} onChange={(e) => setItemRejected(idx, Number(e.target.value))} className="w-full bg-surface border border-divider rounded-control px-3 py-1.5 type-body text-text-primary focus:outline-none focus:border-border-focus" />}</div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {checks.map((check) => <label key={check.id} className="flex items-start gap-2 type-caption text-text-muted"><input type="checkbox" checked={item.checks[check.id]} onChange={(e) => updateItem(idx, "checks", { ...item.checks, [check.id]: e.target.checked })} disabled={isReadOnly} className="mt-0.5 accent-brand" /><span>{check.label}</span></label>)}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>{Number(item.rejectedQuantity) > 0 && (isReadOnly ? <div className="type-caption text-text-muted">Defect: {item.defectReason || "—"}</div> : <select value={item.defectReason} onChange={(e) => updateItem(idx, "defectReason", e.target.value)} className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary focus:outline-none focus:border-border-focus"><option value="">Select defect reason</option>{defectReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select>)}</div>
                      {isReadOnly ? <div className="type-caption text-text-muted">{item.notes || "No item notes."}</div> : <input type="text" placeholder="Optional item notes" value={item.notes} onChange={(e) => updateItem(idx, "notes", e.target.value)} className="w-full bg-surface border border-divider rounded-control px-3 py-2 type-body text-text-primary focus:outline-none focus:border-border-focus" />}
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* INSPECTION BASIS */}
        <div className="space-y-1.5">
          <label className="type-caption font-semibold text-text-primary block">
            Inspection Basis {!isReadOnly && "(Optional)"}
          </label>
          {isReadOnly ? (
            <div className="bg-surface-secondary/40 border border-divider rounded-control p-3 type-body text-text-muted">
              {inspectionBasis || "Recorded in the inspection summary."}
            </div>
          ) : (
            <input
              type="text"
              placeholder="e.g. Approved raw-material specification RM-014, COA no. 8831, receiving temperature 4 C"
              value={inspectionBasis}
              onChange={(e) => setInspectionBasis(e.target.value)}
              className="w-full bg-surface border border-divider rounded-control p-3 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
            />
          )}
        </div>

        {/* VERIFICATION CHOICE & OVERALL NOTES */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="type-caption font-semibold text-text-primary block">
              Verification Choice <span className="text-badge-danger-text">*</span>
            </label>
            {isReadOnly ? (
              <div className="bg-surface-secondary/40 border border-divider rounded-control p-3 type-body font-medium text-text-primary">
                {inspection?.overallNotes?.match(/VERIFICATION:\s*(.*?)(?:\n|$)/)?.[1] || "—"}
              </div>
            ) : (
              <select
                value={verificationChoice}
                onChange={(e) => setVerificationChoice(e.target.value)}
                className="w-full bg-surface border border-divider rounded-control p-3 type-body text-text-primary focus:outline-none focus:border-border-focus"
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
          <div className="space-y-1.5">
            <label className="type-caption font-semibold text-text-primary block">
              Additional Remarks (Optional)
            </label>
            {isReadOnly ? (
              <div className="bg-surface-secondary/40 border border-divider rounded-control p-3 type-body text-text-muted">
                {overallNotes.replace(/VERIFICATION:\s*.*?(?:\n|$)/, "") || "No additional remarks."}
              </div>
            ) : (
              <textarea
                rows={2}
                placeholder="e.g. Visual and laboratory testing confirmed compliant specifications. 10 kg rejected due to moisture damage."
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                className="w-full bg-surface border border-divider rounded-control p-3 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
              />
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-divider pt-4 flex items-center justify-between">
          <div className="type-caption text-text-muted">
            {mismatch && (
              <span className="text-badge-danger-text font-semibold">
                Quantities do not balance! Accepted + Rejected must equal Delivered.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isReadOnly ? (
              <ModalNativeCloseButton
                fallbackOnClose={onClose}
                className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 transition-colors shadow-card cursor-pointer"
              >
                Close
              </ModalNativeCloseButton>
            ) : (
              <>
                <ModalNativeCloseButton
                  fallbackOnClose={onClose}
                  disabled={submitting}
                  className="rounded-control border border-divider bg-surface text-text-primary px-5 py-2.5 type-body font-semibold hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Cancel
                </ModalNativeCloseButton>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || mismatch || missingDefectReasons}
                  className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Complete Quality Assurance Inspection"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal (Matching 440px PO / PR Format) */}
      <ActionConfirmModal
        open={confirmModal}
        title="Confirm Quality Assurance Inspection"
        subtitle={`Inspection No: ${inspection?.inspectionNumber || "N/A"} • GRN No: ${inspection?.referenceNumber || inspection?.grnNumber || "—"}`}
        description={`Are you sure you want to finalize and sign off this Quality Assurance Inspection for ${items.length} item(s) with outcome "${verificationChoice || "Completed"}"?`}
        confirmText="Confirm & Save"
        loading={submitting}
        loadingText="Processing..."
        onConfirm={executeSubmit}
        onClose={() => setConfirmModal(false)}
      />
    </ModalWrapper>
  );
}
