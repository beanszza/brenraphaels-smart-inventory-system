"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Upload, Trash2, X } from "lucide-react";

type Transfer = {
  id: string;
  product: string;
  quantity: number;
  from: string;
  to: string;
  date: string;
  status: "Completed" | "In Transit" | "Pending";
};

type DispatchData = {
  dispatchDate: string;
  driverName: string;
  trackingNumber: string;
  receiptImages: File[];
};

interface DispatchModalProps {
  transfer: Transfer;
  onClose: () => void;
  onConfirm: (id: string, data: DispatchData) => void;
}

export default function DispatchModal({ transfer, onClose, onConfirm }: DispatchModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [dispatchDate, setDispatchDate] = useState("");
  const [dispatchDateError, setDispatchDateError] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverNameError, setDriverNameError] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingNumberError, setTrackingNumberError] = useState("");
  const [receiptError, setReceiptError] = useState("");

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) =>
      ["image/jpeg", "image/png", "image/jpg"].includes(f.type)
    );
    setSelectedFiles((prev) => [...prev, ...valid]);
    valid.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
    if (valid.length > 0) setReceiptError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!dispatchDate) {
      setDispatchDateError("Dispatch date is required.");
      hasError = true;
    }

    if (!driverName.trim()) {
      setDriverNameError("Driver name is required.");
      hasError = true;
    }

    if (!trackingNumber.trim()) {
      setTrackingNumberError("Tracking/Vehicle number is required.");
      hasError = true;
    }

    if (selectedFiles.length === 0) {
      setReceiptError("Proof of transaction (receipt) is required.");
      hasError = true;
    } else {
      setReceiptError("");
    }

    if (hasError || dispatchDateError === "Past date is not allowed." || driverNameError === "No numbers and special characters are allowed." || trackingNumberError === "No special characters or spaces are allowed.") {
      return;
    }

    onConfirm(transfer.id, { dispatchDate, driverName, trackingNumber, receiptImages: selectedFiles });
  };

  const handleDriverNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDriverName(val);
    if (!val.trim()) {
      setDriverNameError("Driver name is required.");
    } else if (!/^[A-Za-z\s]*$/.test(val)) {
      setDriverNameError("No numbers and special characters are allowed.");
    } else {
      setDriverNameError("");
    }
  };

  const handleTrackingNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTrackingNumber(val);
    if (!val.trim()) {
      setTrackingNumberError("Tracking/Vehicle number is required.");
    } else if (!/^[A-Za-z0-9]*$/.test(val)) {
      setTrackingNumberError("No special characters or spaces are allowed.");
    } else {
      setTrackingNumberError("");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-[90vw] max-w-[90vw] sm:max-w-[80vw] md:max-w-[700px] lg:max-w-[900px] max-h-[90vh] overflow-y-auto p-md sm:p-lg rounded-lg sm:rounded-xl border border-border bg-card flex flex-col shadow-2xl text-foreground" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-border pb-3 mb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">Dispatch Transfer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Assign vehicle and driver details to initiate stock transit</p>
          </div>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Info card layout block */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs p-4 bg-muted border border-border rounded-xl mb-4">
          <div><p className="text-[10px] text-muted-foreground font-medium">Product</p><p className="font-semibold text-foreground">{transfer.product}</p></div>
          <div><p className="text-[10px] text-muted-foreground font-medium">Quantity</p><p className="font-semibold text-foreground">{transfer.quantity}</p></div>
          <div><p className="text-[10px] text-muted-foreground font-medium">From</p><p className="font-semibold text-foreground">{transfer.from}</p></div>
          <div><p className="text-[10px] text-muted-foreground font-medium">To</p><p className="font-semibold text-foreground">{transfer.to}</p></div>
          <div className="col-span-2 border-t border-border pt-2"><p className="text-[10px] text-muted-foreground font-medium">Transfer Date</p><p className="font-semibold text-foreground">{transfer.date}</p></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Dispatch Date <span className="text-muted-foreground">*</span></label>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              className={`w-full px-3 py-2 text-sm rounded-lg border ${dispatchDateError ? '!border-destructive focus:!border-destructive focus:ring-1 focus:!ring-destructive' : 'border-border'} bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring`}
              value={dispatchDate}
              onChange={e => {
                const val = e.target.value;
                setDispatchDate(val);
                const today = new Date().toISOString().split("T")[0];
                if (val && val < today) {
                  setDispatchDateError("Past date is not allowed.");
                } else {
                  setDispatchDateError("");
                }
              }}
            />
            {dispatchDateError && <p className="mt-1 text-xs text-destructive">{dispatchDateError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Driver Name</label>
              <input
                type="text"
                placeholder="Driver name"
                className={`w-full px-3 py-2 text-sm rounded-lg border ${driverNameError ? '!border-destructive focus:!border-destructive focus:ring-1 focus:!ring-destructive' : 'border-border'} bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring`}
                value={driverName}
                onChange={handleDriverNameChange}
              />
              {driverNameError && <p className="mt-1 text-xs text-destructive">{driverNameError}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Tracking/Vehicle Number</label>
              <input
                type="text"
                placeholder="e.g., ABC1234"
                className={`w-full px-3 py-2 text-sm rounded-lg border ${trackingNumberError ? '!border-destructive focus:!border-destructive focus:ring-1 focus:!ring-destructive' : 'border-border'} bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring`}
                value={trackingNumber}
                onChange={handleTrackingNumberChange}
              />
              {trackingNumberError && <p className="mt-1 text-xs text-destructive">{trackingNumberError}</p>}
            </div>
          </div>

          {/* Receipt Upload Section */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Proof of Transaction (Receipt) <span className="text-muted-foreground">*</span></label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed ${receiptError ? '!border-destructive' : 'border-border'} p-6 cursor-pointer hover:bg-muted/50 transition-colors bg-card`}
            >
              <Upload size={24} className="text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                Click to add JPG, PNG, or JPEG files
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />
            {receiptError && <p className="mt-1 text-xs text-destructive">{receiptError}</p>}

            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {previews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-lg overflow-hidden border border-border h-20"
                  >
                    <img
                      src={src}
                      alt={`preview ${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="absolute top-1 right-1 p-1 bg-card rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} className="text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-foreground border border-border bg-card hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-lg transition-colors">Start Transit</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
