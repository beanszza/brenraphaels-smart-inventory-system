"use client";

import { listLocations } from "@/app/actions/resources/locations";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Box, Check, MapPin, Calendar, Tag, Building2, Layers, ClipboardCheck } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import api from "@/lib/api";
import { PutAwayTask } from "./types";

interface CompletePutAwayModalProps {
  task: PutAwayTask | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LocationOption {
  locationId: number;
  locationName: string;
  locationType: string;
}

export default function CompletePutAwayModal({
  task,
  open,
  onClose,
  onSuccess,
}: CompletePutAwayModalProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [destinationLocationId, setDestinationLocationId] = useState<number | "">("");
  const [lotCode, setLotCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState(false);

  useEffect(() => {
    if (open && task) {
      setError(null);
      // Auto-generate lot code if none exists
      const initialLot = task.lotCode || `LOT-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${task.itemId}`;
      setLotCode(initialLot);
      setExpiryDate(task.expiryDate ? task.expiryDate.split("T")[0] : "");
      setNotes(task.notes || "");
      setDestinationLocationId(task.destinationLocationId || "");
      loadLocations();
    }
  }, [open, task]);

  const loadLocations = async () => {
    setLoadingLocations(true);
    try {
      const res = await actionResponse(listLocations());
      const list = res.data?.data?.items || res.data?.data || [];
      setLocations(list);
      if (!destinationLocationId && list.length > 0) {
        const warehouseLoc =
          list.find((l: any) => l.locationType !== "Receiving" && l.locationType !== "In Transit") || list[0];
        setDestinationLocationId(warehouseLoc.locationId);
      }
    } catch (err: any) {
      console.error("Failed to load locations:", err);
    } finally {
      setLoadingLocations(false);
    }
  };

  if (!task) return null;

  const isCompleted = task.status === "Completed";

  // Formatted QR Data string
  const qrString = JSON.stringify({
    task: task.putAwayNumber,
    supply: task.itemName,
    supplier: task.supplierName || "—",
    lot: lotCode,
    expiry: expiryDate || "N/A",
    qty: task.acceptedQuantity,
    uom: task.uomName,
    grn: task.grnNumber,
  });

  const handlePrintLabel = () => {
    const style = document.createElement("style");
    style.id = "__putaway-print-style";
    style.media = "print";
    style.innerHTML = `
      @media print {
        body > *:not(#putaway-print-root) { display: none !important; }
        #putaway-print-root { display: block !important; position: fixed; inset: 0; background: white; z-index: 99999; padding: 24px; color: black; font-family: sans-serif; }
      }
    `;
    document.head.appendChild(style);

    let printRoot = document.getElementById("putaway-print-root");
    if (!printRoot) {
      printRoot = document.createElement("div");
      printRoot.id = "putaway-print-root";
      document.body.appendChild(printRoot);
    }

    const locName = locations.find((l) => l.locationId === Number(destinationLocationId))?.locationName || "Warehouse Storage";
    const printedAt = new Date().toLocaleString("en-PH");

    // Grab svg element HTML
    const svgEl = document.getElementById("putaway-qr-svg");
    const svgHtml = svgEl ? svgEl.outerHTML : "";

    printRoot.innerHTML = `
      <div style="max-width:480px;margin:0 auto;border:2px solid #000;border-radius:12px;padding:20px;font-family:sans-serif;color:#111">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px">
          <div>
            <div style="font-size:16px;font-weight:900;letter-spacing:0.5px">COMMISSARY INVENTORY LABEL</div>
            <div style="font-size:11px;color:#555">Put Away Release / Storage Slip</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:monospace;font-weight:800;font-size:14px">${task.putAwayNumber}</div>
            <div style="font-size:10px;color:#666">Goods Receipt Note: ${task.grnNumber}</div>
          </div>
        </div>

        <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
          <div style="flex-shrink:0;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff">
            ${svgHtml}
          </div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:800;line-height:1.2;margin-bottom:4px">${task.itemName}</div>
            <div style="font-size:12px;font-weight:600;color:#444;margin-bottom:8px">Supplier: ${task.supplierName || "—"}</div>
            <div style="font-size:14px;font-weight:700;color:#059669">
              ${task.acceptedQuantity.toLocaleString()} ${task.uomName}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f8f8f8;padding:12px;border-radius:8px;border:1px solid #eee;font-size:11px;margin-bottom:14px">
          <div>
            <span style="font-size:9px;color:#666;font-weight:700;text-transform:uppercase;display:block">Lot Number</span>
            <strong style="font-family:monospace;font-size:12px">${lotCode || "—"}</strong>
          </div>
          <div>
            <span style="font-size:9px;color:#666;font-weight:700;text-transform:uppercase;display:block">Expiry Date</span>
            <strong style="font-size:12px">${expiryDate || "Non-expiring"}</strong>
          </div>
          <div>
            <span style="font-size:9px;color:#666;font-weight:700;text-transform:uppercase;display:block">Storage Bay / Rack</span>
            <strong>${locName}</strong>
          </div>
          <div>
            <span style="font-size:9px;color:#666;font-weight:700;text-transform:uppercase;display:block">Purchase Order Number</span>
            <span style="font-family:monospace">${task.poNumber || "—"}</span>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:9px;color:#888;border-top:1px solid #ddd;padding-top:8px">
          <span>Printed: ${printedAt}</span>
          <span>Status: Verified & Put to Inventory</span>
        </div>
      </div>
    `;

    window.print();

    setTimeout(() => {
      style.remove();
      printRoot?.remove();
    }, 1000);
  };

  const handleTryPutToInventory = () => {
    setConfirmModal(true);
  };

  const handlePutToInventory = async () => {
    setSubmitting(true);
    setError(null);

    const payload = {
      destinationLocationId: Number(destinationLocationId || task.destinationLocationId || 5),
      lotCode: lotCode.trim() || undefined,
      expiryDate: expiryDate || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await api.post(`/api/PutAway/${task.putAwayId}/complete`, payload);
      if (res.data?.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.data?.message || "Failed to complete Put Away.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to complete Put Away.");
    } finally {
      setSubmitting(false);
      setConfirmModal(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title={`${isCompleted ? "View" : "Execute"} Put Away — ${task.putAwayNumber}`}
      onClose={onClose}
      size="max-w-3xl"
    >
      <div className="space-y-6 text-foreground">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* TOP SUMMARY & QR CODE BANNER */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border shadow-xs shrink-0">
              <QRCodeSVG
                id="putaway-qr-svg"
                value={qrString}
                size={120}
                level="M"
                includeMargin={false}
              />
              <span className="text-[10px] font-mono font-semibold text-neutral-600 mt-2">
                SCAN FOR DETAILS
              </span>
            </div>

            {/* Core Item Details */}
            <div className="flex-1 space-y-3 w-full">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Supply / Ingredient Name
                </span>
                <h3 className="text-xl font-extrabold text-foreground">{task.itemName}</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {task.supplierName && task.supplierName !== "—" && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                      Supplier
                    </span>
                    <span className="font-semibold text-foreground truncate block" title={task.supplierName}>
                      {task.supplierName}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                    Accepted Qty
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    {task.acceptedQuantity.toLocaleString()} {task.uomName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                    Source Goods Receipt Note
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {task.grnNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INPUTS FOR LOT, EXPIRY, AND DESTINATION */}
        <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4 text-xs">
          <p className="text-sm font-bold text-foreground">Traceability &amp; Storage Placement</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block space-y-1.5">
                <span className="font-semibold text-foreground">Lot Number *</span>
                <input
                  type="text"
                  readOnly={isCompleted}
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="e.g. LOT-2026-0921"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm font-mono ${
                    isCompleted
                      ? "bg-muted/40 text-muted-foreground cursor-not-allowed border border-border"
                      : "bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  }`}
                />
              </label>
            </div>

            <div>
              <label className="block space-y-1.5">
                <span className="font-semibold text-foreground">Expiry Date</span>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  readOnly={isCompleted}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm ${
                    isCompleted
                      ? "bg-muted/40 text-muted-foreground cursor-not-allowed border border-border"
                      : "bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  }`}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block space-y-1.5">
                <span className="font-semibold text-foreground">Destination Storage Bay / Location</span>
                <select
                  disabled={isCompleted || loadingLocations}
                  value={destinationLocationId}
                  onChange={(e) => setDestinationLocationId(Number(e.target.value))}
                  className={`w-full rounded-xl px-3 py-2.5 text-sm ${
                    isCompleted
                      ? "bg-muted/40 text-muted-foreground cursor-not-allowed border border-border"
                      : "bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  }`}
                >
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.locationName} ({loc.locationType})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className="block space-y-1.5">
                <span className="font-semibold text-foreground">Put Away Notes</span>
                <input
                  type="text"
                  readOnly={isCompleted}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes or rack/bin details"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm ${
                    isCompleted
                      ? "bg-muted/40 text-muted-foreground cursor-not-allowed border border-border"
                      : "bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  }`}
                />
              </label>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS: PRINT LABEL & PUT TO INVENTORY */}
        <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={handlePrintLabel}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print Label &amp; QR
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isCompleted ? (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
                  onClick={handleTryPutToInventory}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Box className="h-4 w-4" />
                  {submitting ? "Putting to Inventory…" : "Put to Inventory"}
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
                      Complete Put Away
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      You are about to put this item into inventory.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-2 border border-border">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Put Away #:</span>
                    <span className="font-semibold text-foreground">
                      {task.putAwayNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {locations.find((l) => l.locationId === destinationLocationId)?.locationName || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Action:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      Finalize & Put to Inventory
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
                    onClick={handlePutToInventory}
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
