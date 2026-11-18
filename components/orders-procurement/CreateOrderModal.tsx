"use client";
import { Skeleton } from "@/components/ui/skeleton";

import { supplierItemsByItem } from "@/app/actions/orders/catalog";
import { actionResponse } from "@/lib/resources/action-response";


import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Sparkles, Clock, DollarSign, Package } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";
import { Order, SupplyItem, Supplier, PaymentType } from "./types";

interface ItemSupplierOption {
  supplierId: number;
  supplierName: string;
  unitPrice: number;
  currency: string;
  purchaseUomId: number;
  purchaseUomName: string;
  packSize: number;
  leadTimeDays: number;
  minOrderQuantity: number;
  isPreferred: boolean;
}

interface CreateOrderModalProps {
  open: boolean;
  editingOrder: Order | null;
  itemsList: SupplyItem[];
  suppliersList: Supplier[];
  onClose: () => void;
  onSave: (formData: FormData, isEdit: boolean) => Promise<void>;
}

export default function CreateOrderModal({
  open,
  editingOrder,
  itemsList,
  suppliersList,
  onClose,
  onSave,
}: CreateOrderModalProps) {
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [eta, setEta] = useState("");
  const [payment, setPayment] = useState<PaymentType>("Payable");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Supplier Catalog Filtering State
  const [itemSuppliers, setItemSuppliers] = useState<ItemSupplierOption[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [selectedSupplierOption, setSelectedSupplierOption] = useState<ItemSupplierOption | null>(null);

  const [supplierError, setSupplierError] = useState("");
  const [itemError, setItemError] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [etaError, setEtaError] = useState("");
  const [receiptError, setReceiptError] = useState("");

  useEffect(() => {
    if (editingOrder) {
      setSupplierId(editingOrder.supplierId?.toString() || "");
      setItemId(editingOrder.itemId?.toString() || "");
      setQuantity(editingOrder.quantity?.toString() || "");
      setEta(editingOrder.eta || "");
      setPayment(editingOrder.payment || "Payable");
    } else {
      setSupplierId("");
      setItemId("");
      setQuantity("");
      setEta("");
      setPayment("Payable");
    }
    setReceiptFile(null);
    setSupplierError("");
    setItemError("");
    setQuantityError("");
    setEtaError("");
    setReceiptError("");
    setItemSuppliers([]);
    setSelectedSupplierOption(null);
  }, [editingOrder, open]);

  // When Item changes, load suppliers specifically catalogued for that item
  const handleItemChange = async (newItemIdStr: string) => {
    setItemId(newItemIdStr);
    setItemError("");
    setSupplierId("");
    setSelectedSupplierOption(null);

    if (!newItemIdStr) {
      setItemSuppliers([]);
      return;
    }

    const newItemId = parseInt(newItemIdStr, 10);
    if (isNaN(newItemId)) return;

    setLoadingSuppliers(true);
    try {
      const res = await actionResponse(supplierItemsByItem(newItemId));

      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const suppliers: ItemSupplierOption[] = res.data.data;
        setItemSuppliers(suppliers);

        // Auto-select preferred supplier or first vendor
        const preferred = suppliers.find((s) => s.isPreferred) || suppliers[0];
        if (preferred) {
          setSupplierId(preferred.supplierId.toString());
          setSelectedSupplierOption(preferred);
          setSupplierError("");

          // Auto-calculate suggested ETA if not set
          if (!eta && preferred.leadTimeDays > 0) {
            const d = new Date();
            d.setDate(d.getDate() + preferred.leadTimeDays);
            setEta(d.toISOString().split("T")[0]);
          }
        }
      } else {
        setItemSuppliers([]);
      }
    } catch (err) {
      console.error("Failed to load item supplier options", err);
      setItemSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleSupplierChange = (newSupplierIdStr: string) => {
    setSupplierId(newSupplierIdStr);
    setSupplierError("");

    const matched = itemSuppliers.find((s) => s.supplierId.toString() === newSupplierIdStr);
    setSelectedSupplierOption(matched || null);

    if (matched && matched.leadTimeDays > 0 && !editingOrder) {
      const d = new Date();
      d.setDate(d.getDate() + matched.leadTimeDays);
      setEta(d.toISOString().split("T")[0]);
    }
  };

  const handleSubmit = async () => {
    let isValid = true;
    if (!itemId) { setItemError("Item is required."); isValid = false; }
    if (!supplierId) { setSupplierError("Supplier is required."); isValid = false; }
    if (!quantity || Number(quantity) <= 0) { setQuantityError("Valid quantity is required."); isValid = false; }
    const etaValidation = getFutureDateError(eta, "Expected arrival date");
    if (etaValidation) { setEtaError(etaValidation); isValid = false; }
    if (!editingOrder && !receiptFile) { setReceiptError("Receipt or PO proof is required."); isValid = false; }

    if (!isValid) return;

    try {
      setIsSaving(true);
      const fd = new FormData();
      fd.append("SupplierId", supplierId);
      fd.append("ItemId", itemId);
      fd.append("Quantity", quantity);
      fd.append("Eta", eta);
      fd.append("Payment", payment);
      if (receiptFile) fd.append("Receipt", receiptFile);

      await onSave(fd, !!editingOrder);
      onClose();
    } catch {
      alert("Failed to save order.");
    } finally {
      setIsSaving(false);
    }
  };

  const numQty = parseFloat(quantity) || 0;
  const estTotal = selectedSupplierOption && numQty > 0 ? (selectedSupplierOption.unitPrice * numQty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

  return (
    <ModalWrapper open={open} title={editingOrder ? "Edit Purchase Order" : "Create New Purchase Order"} onClose={onClose} size="max-w-[560px]">
      <div className="space-y-4">
        {/* Item Selection First */}
        <div>
          <label className="mb-1.5 block type-label font-semibold text-text-primary">
            1. Select Product / Raw Material <span className="text-status-red">*</span>
          </label>
          <select
            value={itemId}
            onChange={(e) => handleItemChange(e.target.value)}
            className="w-full rounded-control border border-divider bg-surface px-3 py-2 type-body text-text-primary focus:ring-1 focus:ring-ring"
          >
            <option value="" disabled hidden>Choose item to order...</option>
            {itemsList.map((i) => (
              <option key={i.itemId} value={i.itemId}>
                {i.itemName} {i.uomName ? `(${i.uomName})` : ""} - {i.categoryName}
              </option>
            ))}
          </select>
          {itemError && <p className="mt-1 type-caption text-status-red">{itemError}</p>}
        </div>

        {/* Supplier Dropdown - Filtered by Item */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="type-label font-semibold text-text-primary">
              2. Vendor / Supplier <span className="text-status-red">*</span>
            </label>
            {loadingSuppliers && (
              <span className="type-caption text-text-muted flex items-center gap-1">
                <Skeleton className="h-5 w-24" /> Finding approved vendors...
              </span>
            )}
            {itemSuppliers.length > 0 && !loadingSuppliers && (
              <span className="type-caption text-status-green font-medium">
                {itemSuppliers.length} vendor(s) catalogued
              </span>
            )}
          </div>

          <select
            value={supplierId}
            onChange={(e) => handleSupplierChange(e.target.value)}
            disabled={loadingSuppliers || !itemId}
            className="w-full rounded-control border border-divider bg-surface px-3 py-2 type-body text-text-primary focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            <option value="" disabled hidden>
              {!itemId ? "Select item first..." : itemSuppliers.length > 0 ? "Select from approved item suppliers..." : "Select supplier..."}
            </option>
            {itemSuppliers.length > 0
              ? itemSuppliers.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.supplierName} {s.isPreferred ? "★ (Preferred Vendor)" : ""} — ₱{s.unitPrice.toFixed(2)} / {s.purchaseUomName} (Lead: {s.leadTimeDays}d)
                  </option>
                ))
              : suppliersList.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.companyName}
                  </option>
                ))}
          </select>
          {supplierError && <p className="mt-1 type-caption text-status-red">{supplierError}</p>}

          {/* Supplier Catalog Info Card */}
          {selectedSupplierOption && (
            <div className="mt-2 rounded-control border border-divider bg-surface-muted p-2.5 flex flex-wrap items-center justify-between gap-2 type-caption">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-semibold text-text-primary">
                  <DollarSign size={13} className="text-primary" /> ₱{selectedSupplierOption.unitPrice.toFixed(2)} / {selectedSupplierOption.purchaseUomName}
                </span>
                <span className="flex items-center gap-1 text-text-muted">
                  <Clock size={13} /> {selectedSupplierOption.leadTimeDays} days lead time
                </span>
                {selectedSupplierOption.packSize > 1 && (
                  <span className="flex items-center gap-1 text-text-muted">
                    <Package size={13} /> Pack: {selectedSupplierOption.packSize} units
                  </span>
                )}
              </div>
              {selectedSupplierOption.isPreferred && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill type-caption font-bold bg-primary/10 text-primary border border-primary/20">
                  <Sparkles size={10} /> Preferred Supplier
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              3. Order Quantity <span className="text-status-red">*</span>
            </label>
            <Input
              type="number"
              min={0.001}
              step={0.001}
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setQuantityError(""); }}
              placeholder="e.g. 50"
              className="rounded-control border border-divider bg-surface text-text-primary type-body"
            />
            {quantityError && <p className="mt-1 type-caption text-status-red">{quantityError}</p>}
            {estTotal && (
              <p className="mt-1 type-caption text-text-muted">
                Est. Total: <span className="font-semibold text-text-primary">₱{estTotal}</span>
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Expected Arrival (ETA) <span className="text-status-red">*</span>
            </label>
            <Input
              type="date"
              min={getTodayDateString()}
              max={getMaxFutureDateString()}
              value={eta}
              onChange={(e) => { setEta(e.target.value); setEtaError(""); }}
              className="rounded-control border border-divider bg-surface text-text-primary type-body"
            />
            {etaError && <p className="mt-1 type-caption text-status-red">{etaError}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block type-label font-semibold text-text-primary">Payment Type <span className="text-status-red">*</span></label>
          <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentType)} className="w-full rounded-control border border-divider bg-surface px-3 py-2 type-body text-text-primary focus:ring-1 focus:ring-ring">
            <option value="Payable">Payable</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block type-label font-semibold text-text-primary">Receipt / Purchase Order Attachment {!editingOrder && "*"}</label>
          <div className="border border-dashed border-divider rounded-control p-4 text-center hover:bg-surface-hover transition-colors relative">
            <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => { setReceiptFile(e.target.files?.[0] || null); setReceiptError(""); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            <div className="flex flex-col items-center pointer-events-none">
              <Upload className="w-6 h-6 text-text-muted mb-1" />
              <span className="type-caption font-medium text-text-primary">{receiptFile ? receiptFile.name : "Upload receipt / Purchase Order document"}</span>
            </div>
          </div>
          {receiptError && <p className="mt-1 type-caption text-status-red">{receiptError}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-divider">
          <ModalCloseButton type="button" variant="outline" fallbackOnClose={onClose} disabled={isSaving} className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
            Cancel
          </ModalCloseButton>
          <Button type="button" onClick={handleSubmit} disabled={isSaving} className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors cursor-pointer">
            {isSaving ? <Skeleton className="h-5 w-24" /> : editingOrder ? "Save Changes" : "Create Order"}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
