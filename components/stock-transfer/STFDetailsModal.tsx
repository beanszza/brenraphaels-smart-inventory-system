"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, MapPin, Truck, Package, User, FileText, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransfer } from "./types";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";
import { isFileId } from "@/lib/files";
import { resolveTransferAttachment } from "@/app/actions/stock-transfer/transfer-files";
import { TransferProofThumbnail } from "./TransferProofThumbnail";

interface STFDetailsModalProps {
  transfer: StockTransfer | null;
  open: boolean;
  onClose: () => void;
  onDispatch?: (transfer: StockTransfer) => void;
  onCancel?: (transfer: StockTransfer) => void;
}

export function STFDetailsModal({
  transfer,
  open,
  onClose,
  onDispatch,
  onCancel,
}: STFDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  const { requestClose, confirmModal } = useConfirmedClose(onClose);

  if (!open || !mounted || !transfer) return null;

  const isScheduled = transfer.status === "Scheduled";

  let schedMeta: any = {};
  let dispatchMeta: any = {};
  if (transfer.notes) {
    const parts = transfer.notes.split(" | ");
    for (const part of parts) {
      try {
        const p = JSON.parse(part);
        if (p.transportProvider || p.plateNumber || p.driverName || p.attachmentData || p.attachmentName) {
          schedMeta = { ...schedMeta, ...p };
        }
        if (p.actualDispatchDate || p.proofDataUrl || p.proofFileName || p.releasedBy) {
          dispatchMeta = { ...dispatchMeta, ...p };
        }
      } catch {
        // not json
      }
    }
  }

  const rawBookingSrc = transfer.proofOfReceipt || schedMeta.attachmentFileId || schedMeta.attachmentData || "";
  const rawDispatchSrc = dispatchMeta.proofFileId || dispatchMeta.proofDataUrl || "";

  const [resolvedBookingUrl, setResolvedBookingUrl] = useState<string>("");
  const [resolvedDispatchUrl, setResolvedDispatchUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (rawBookingSrc) {
      if (rawBookingSrc.startsWith("data:") || rawBookingSrc.startsWith("http")) {
        setResolvedBookingUrl(rawBookingSrc);
      } else if (isFileId(rawBookingSrc)) {
        resolveTransferAttachment(rawBookingSrc)
          .then((res) => {
            if (active && res.data?.url) setResolvedBookingUrl(res.data.url);
          })
          .catch(() => {});
      }
    } else {
      setResolvedBookingUrl("");
    }

    if (rawDispatchSrc) {
      if (rawDispatchSrc.startsWith("data:") || rawDispatchSrc.startsWith("http")) {
        setResolvedDispatchUrl(rawDispatchSrc);
      } else if (isFileId(rawDispatchSrc)) {
        resolveTransferAttachment(rawDispatchSrc)
          .then((res) => {
            if (active && res.data?.url) setResolvedDispatchUrl(res.data.url);
          })
          .catch(() => {});
      }
    } else {
      setResolvedDispatchUrl("");
    }

    return () => {
      active = false;
    };
  }, [rawBookingSrc, rawDispatchSrc]);

  const bookingProofSrc = resolvedBookingUrl || rawBookingSrc;
  const dispatchProofSrc = resolvedDispatchUrl || rawDispatchSrc;

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-backdrop p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "720px" }}
        className="w-full max-h-[90vh] bg-surface rounded-panel shadow-2xl border border-divider overflow-hidden flex flex-col text-text-primary shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="type-modal-title text-text-primary">
                Stock Transfer Details
              </h2>
              <StatusBadge status={transfer.status} />
            </div>
            <p className="text-xs font-semibold text-text-muted mt-0.5">
              {transfer.transferNumber}{" "}
              {transfer.requestNumber && `(Ref: ${transfer.requestNumber})`}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-control border border-divider bg-muted/20 p-4 text-xs">
            <div className="space-y-1">
              <span className="type-overline font-semibold text-text-muted uppercase tracking-wider">
                Origin Location
              </span>
              <div className="flex items-center gap-1.5 font-medium text-text-primary">
                <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>{transfer.sourceLocationName || "Commissary (Central Kitchen)"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="type-overline font-semibold text-text-muted uppercase tracking-wider">
                Destination Branch
              </span>
              <div className="flex items-center gap-1.5 font-medium text-text-primary">
                <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>{transfer.destLocationName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="type-overline font-semibold text-text-muted uppercase tracking-wider">
                Scheduled Date
              </span>
              <div className="flex items-center gap-1.5 font-medium text-text-primary">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>
                  {transfer.scheduledDate
                    ? new Date(transfer.scheduledDate).toLocaleDateString()
                    : "Not Scheduled"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="type-overline font-semibold text-text-muted uppercase tracking-wider">
                Dispatched Date
              </span>
              <div className="flex items-center gap-1.5 font-medium text-text-primary">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>
                  {transfer.dispatchedDate
                    ? new Date(transfer.dispatchedDate).toLocaleString()
                    : "Not Dispatched"}
                </span>
              </div>
            </div>
          </div>

          {/* Product & Quantity Card */}
          <div className="rounded-control border border-divider bg-surface p-4 text-xs space-y-3">
            <h3 className="type-card-title text-text-primary flex items-center gap-2">
              <Package className="w-4 h-4 text-text-muted" />
              Transfer Item Information
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  Product
                </span>
                <p className="font-semibold text-text-primary mt-0.5">{transfer.productName}</p>
              </div>
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  Variant
                </span>
                <p className="text-text-primary mt-0.5">{transfer.variant || "Standard"}</p>
              </div>
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  SKU
                </span>
                <p className="text-text-muted mt-0.5">{transfer.sku || "—"}</p>
              </div>
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  Transfer Qty
                </span>
                <p className="type-card-title font-semibold text-text-primary mt-0.5">
                  {transfer.transferQuantity}
                </p>
              </div>
            </div>
          </div>

          {/* Logistics Details */}
          <div className="rounded-control border border-divider bg-muted/20 p-4 text-xs space-y-3">
            <h3 className="type-card-title text-text-primary flex items-center gap-2">
              <Truck className="w-4 h-4 text-text-muted" />
              Logistics & Courier Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  Driver Name
                </span>
                <p className="font-medium text-text-primary mt-0.5">{transfer.driverName || "—"}</p>
              </div>
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  Vehicle Plate
                </span>
                <p className="text-text-primary mt-0.5">{transfer.vehiclePlate || "—"}</p>
              </div>
              <div>
                <span className="type-overline text-text-muted uppercase font-semibold">
                  Courier Company
                </span>
                <p className="font-medium text-text-primary mt-0.5">{transfer.courierName || "In-House"}</p>
              </div>
            </div>
          </div>

          {/* Document Proofs & Attachments */}
          {(bookingProofSrc || dispatchProofSrc) && (
            <div className="rounded-control border border-divider bg-surface p-4 text-xs space-y-2.5">
              <h3 className="type-card-title text-text-primary flex items-center gap-2">
                <FileText className="w-4 h-4 text-text-muted" />
                Document Proofs &amp; Photo Attachments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {bookingProofSrc && (
                  <TransferProofThumbnail
                    rawSrc={bookingProofSrc}
                    title="Booking / Transaction Receipt"
                    subtitle={schedMeta.attachmentName || "Uploaded when scheduling"}
                    onPreview={setPreviewImage}
                    size="small"
                  />
                )}

                {dispatchProofSrc && (
                  <TransferProofThumbnail
                    rawSrc={dispatchProofSrc}
                    title="Dispatch Proof Photo"
                    subtitle={dispatchMeta.proofFileName || "Uploaded upon departure"}
                    onPreview={setPreviewImage}
                    size="small"
                  />
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {transfer.notes && (
            <div className="rounded-control border border-divider bg-surface p-4 text-xs space-y-1">
              <span className="type-overline font-semibold text-text-muted uppercase tracking-wider">
                Notes & Instructions
              </span>
              <p className="text-text-primary leading-relaxed">{transfer.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-divider px-6 py-4 bg-muted/10">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-control bg-surface border border-divider px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Close
          </button>

          {/* Only Inventory Manager can dispatch or cancel (Admin is view-only here!) */}
          {isScheduled && (
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCancel(transfer);
                  }}
                  className="rounded-control bg-surface border border-divider px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Cancel Transfer
                </button>
              )}
              {onDispatch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDispatch(transfer);
                  }}
                  className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                >
                  Dispatch Transfer
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="font-sans fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface text-text-primary rounded-panel max-w-2xl w-full border border-divider p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-divider pb-2">
              <h5 className="text-xs font-semibold text-text-primary uppercase truncate pr-4">{previewImage.title}</h5>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="h-7 px-3 text-xs rounded-lg border border-divider bg-surface text-text-primary hover:bg-surface-hover font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex items-center justify-center bg-muted/20 rounded-control p-2 max-h-[70vh] overflow-auto">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
