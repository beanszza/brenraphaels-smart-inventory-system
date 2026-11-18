"use client";
import { Skeleton } from "@/components/ui/skeleton";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Upload } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { Order } from "./types";
import { procurement } from "@/lib/orders/client";
import { uploadWith } from "@/lib/file-upload";
import { actionResponse } from "@/lib/resources/action-response";
import { confirmReceiptUpload, requestReceiptUpload } from "@/app/actions/orders/receipts";
import { HR_EMPLOYEES } from "@/lib/employees";

interface ProcurementQAInspectionModalProps {
  order: Order | null;
  onClose: () => void;
  onComplete: () => void;
}

export default function ProcurementQAInspectionModal({
  order,
  onClose,
  onComplete,
}: ProcurementQAInspectionModalProps) {
  const [checklist, setChecklist] = useState({
    quantityMatch: false,
    goodCondition: false,
    specsMatch: false,
    docsCorrect: false,
  });
  const [comment, setComment] = useState("");
  const [inspectedBy, setInspectedBy] = useState("");
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [inspectedByError, setInspectedByError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!order) return null;

  const isAllChecked = checklist.quantityMatch && checklist.goodCondition && checklist.specsMatch && checklist.docsCorrect;
  const result = isAllChecked ? "Passed" : "Failed";

  const handleRequestComplete = () => {
    let isValid = true;
    if (!inspectedBy.trim()) { setInspectedByError("Inspected by is required."); isValid = false; }
    if (!pictureFile) { setPhotoError("Inspection proof photo is required."); isValid = false; }
    if (!isValid) return;
    setConfirmOpen(true);
  };

  const handleComplete = async () => {
    setConfirmOpen(false);
    try {
      setIsSaving(true);
      const targetStatus = result === "Passed" ? "Completed" : "Rejected";
      const res = await procurement.setOrderStatus(order.poId, {
        status: targetStatus,
        qaNotes: comment,
        qaStatus: result,
      });

      if (res.data.success) {
        if (pictureFile) {
          await uploadWith(
            {
              request: async (meta) => (await actionResponse(requestReceiptUpload(order.poId, meta))).data.data,
              confirm: async (fileId) => void (await actionResponse(confirmReceiptUpload(order.poId, fileId))),
            },
            pictureFile,
          );
        }
        onComplete();
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit Quality Assurance Inspection.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalWrapper open={!!order} title={`Quality Assurance Inspection - Order ${order.id}`} onClose={onClose} size="max-w-[560px]">
      <div className="space-y-4">
        <div className="p-3 bg-surface-muted border border-divider rounded-card grid grid-cols-2 sm:grid-cols-4 gap-3 type-caption">
          <div><span className="text-text-muted">Item:</span> <span className="font-bold text-text-primary">{order.item}</span></div>
          <div><span className="text-text-muted">Supplier:</span> <span className="font-medium text-text-primary">{order.supplier}</span></div>
          <div><span className="text-text-muted">Qty:</span> <span className="font-bold text-text-primary">{order.quantity}</span></div>
          <div><span className="text-text-muted">Status:</span> <span className="font-semibold text-text-primary">{result}</span></div>
        </div>

        <div className="space-y-2">
          {[
            { key: "quantityMatch", label: "Quantity Verification", desc: "Delivered quantity matches ordered quantity." },
            { key: "goodCondition", label: "Condition & Quality", desc: "Materials arrived with no defects or damage." },
            { key: "specsMatch", label: "Specification Match", desc: "Item specifications match the purchase order." },
            { key: "docsCorrect", label: "Documentation Check", desc: "Receipts and invoices are verified." },
          ].map((item) => {
            const isChecked = checklist[item.key as keyof typeof checklist];
            return (
              <div
                key={item.key}
                onClick={() => setChecklist((prev) => ({ ...prev, [item.key]: !isChecked }))}
                className={`p-3 rounded-card border transition-colors cursor-pointer flex items-start gap-3 select-none ${
                  isChecked ? "border-text-primary bg-surface-muted" : "border-divider bg-surface hover:border-text-primary/40"
                }`}
              >
                <div className={`w-4 h-4 rounded-xs mt-0.5 flex items-center justify-center border ${isChecked ? "bg-primary border-primary text-text-inverse" : "border-divider"}`}>
                  {isChecked && <Check size={12} strokeWidth={3} />}
                </div>
                <div>
                  <p className="type-label font-bold text-text-primary">{item.label}</p>
                  <p className="type-caption text-text-muted">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">Inspected By <span className="text-status-red">*</span></label>
            <select
              value={inspectedBy}
              onChange={(e) => { setInspectedBy(e.target.value); setInspectedByError(""); }}
              className="w-full rounded-control border border-divider bg-surface px-3 py-2 type-body text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select inspector...</option>
              {HR_EMPLOYEES.map((employee) => (
                <option key={employee} value={employee}>{employee}</option>
              ))}
            </select>
            {inspectedByError && <p className="mt-1 type-caption text-status-red">{inspectedByError}</p>}
          </div>
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">Inspection Photo / Proof <span className="text-status-red">*</span></label>
            <div className="border border-dashed border-divider rounded-control p-3 text-center hover:bg-surface-hover relative">
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => { setPictureFile(e.target.files?.[0] || null); setPhotoError(""); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              <div className="flex items-center justify-center gap-2 pointer-events-none type-caption text-text-primary">
                <Upload className="w-4 h-4 text-text-muted" />
                <span>{pictureFile ? pictureFile.name : "Upload photo"}</span>
              </div>
            </div>
            {photoError && <p className="mt-1 type-caption text-status-red">{photoError}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block type-label font-semibold text-text-primary">Notes (Optional)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Inspection feedback or remarks..." rows={2} className="w-full rounded-control border border-divider bg-surface p-3 type-body text-text-primary placeholder:text-text-muted resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-divider">
          <ModalCloseButton type="button" variant="outline" fallbackOnClose={onClose} disabled={isSaving} className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
            Cancel
          </ModalCloseButton>
          <Button type="button" onClick={handleRequestComplete} disabled={isSaving} className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors flex items-center gap-2 cursor-pointer">
            {isSaving && <Skeleton className="h-5 w-24" />}
            Submit Quality Assurance Inspection ({result})
          </Button>
        </div>
      </div>

      <ActionConfirmModal
        open={confirmOpen}
        title="Submit Quality Assurance Inspection"
        subtitle={`Order No: ${order.id} • Result: ${result}`}
        description={`Are you sure you want to submit this Quality Assurance Inspection with status "${result}" for Order ${order.id}?`}
        confirmLabel="Confirm & Submit"
        submitting={isSaving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleComplete}
      />
    </ModalWrapper>
  );
}
