"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Users,
  CheckCircle2,
  Mail,
  FileText,
  ExternalLink,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { PurchaseRequisition, PurchaseOrderPO } from "../types";
import { useStaff } from "@/context/StaffContext";
import { procurement } from "@/lib/orders/client";
import { supplierItemsByItem, supplierItemsBySupplier } from "@/app/actions/orders/catalog";
import { actionResponse } from "@/lib/resources/action-response";
import { downloadPurchaseOrderPdf } from "./downloadPurchaseOrderPdf";
import { Download } from "lucide-react";

interface ItemRow {
  itemId: number;
  itemName: string;
  uomName: string;
  purchaseUomId: number;
  alreadyOrdered: number;
  requestedQty: number;
  remaining: number;
  orderQty: string;
}

interface CreatePOModalProps {
  open: boolean;
  initialPrId?: number;
  initialPo?: PurchaseOrderPO | null;
  isEdit?: boolean;
  onClose: () => void;
  onSuccess: (createdPo?: PurchaseOrderPO) => void;
}

export function CreatePOModal({
  open,
  initialPrId,
  initialPo,
  isEdit = false,
  onClose,
  onSuccess,
}: CreatePOModalProps) {
  const staff = useStaff();

  const [step, setStep] = useState(1);

  // Step 1: Approved Purchase Requisitions
  const [approvedPRs, setApprovedPRs] = useState<PurchaseRequisition[]>([]);
  const [prSearch, setPrSearch] = useState("");
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
  const [loadingPRs, setLoadingPRs] = useState(false);

  // Step 2: Suppliers
  const [eligibleSuppliers, setEligibleSuppliers] = useState<
    { supplierId: number; supplierName: string; email?: string; contactPerson?: string; address?: string }[]
  >([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Step 3: Quantities
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [nextPoNumber, setNextPoNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isReviewing, setIsReviewing] = useState(false);

  // Post-submit success state (Draft opened in Gmail)
  const [createdOrder, setCreatedOrder] = useState<PurchaseOrderPO | null>(null);
  const [gmailComposeUrl, setGmailComposeUrl] = useState<string>("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (open) {
      if (isEdit && initialPo) {
        setStep(3);
        setNextPoNumber(initialPo.poNumber);
        setSelectedSupplierId(initialPo.supplierId);
        setEligibleSuppliers([
          {
            supplierId: initialPo.supplierId,
            supplierName: initialPo.supplierName,
            email: initialPo.supplierEmail,
            contactPerson: initialPo.supplierContactPerson,
            address: initialPo.supplierAddress,
          },
        ]);
        if (initialPo.prId) {
          setSelectedPR({
            prId: initialPo.prId,
            prNumber: initialPo.prNumber || `PR-${initialPo.prId}`,
            requestedBy: initialPo.requestedBy,
            items: [],
          } as any);
        } else {
          setSelectedPR(null);
        }
        setItemRows(
          (initialPo.items || []).map((it: any) => ({
            itemId: it.itemId,
            itemName: it.itemName,
            uomName: it.purchaseUomName || "Unit",
            purchaseUomId: it.purchaseUomId || 0,
            alreadyOrdered: 0,
            requestedQty: it.poItemQuantity,
            remaining: it.poItemQuantity,
            orderQty: String(it.poItemQuantity),
          }))
        );
        setErrors({});
        setIsReviewing(false);
        setCreatedOrder(null);
        setGmailComposeUrl("");
      } else {
        setStep(1);
        setPrSearch("");
        setSelectedPR(null);
        setSelectedSupplierId(null);
        setItemRows([]);
        setErrors({});
        setIsReviewing(false);
        setCreatedOrder(null);
        setGmailComposeUrl("");
        fetchApprovedPRs();
        fetchNextPoNumber();
      }
    }
  }, [open, isEdit, initialPo]);

  useEffect(() => {
    if (!isEdit && initialPrId && approvedPRs.length > 0) {
      const pr = approvedPRs.find((p) => p.prId === initialPrId);
      if (pr) {
        setSelectedPR(pr);
        fetchEligibleSuppliers(pr);
        setStep(2);
      }
    }
  }, [initialPrId, approvedPRs, isEdit]);

  const fetchApprovedPRs = async () => {
    setLoadingPRs(true);
    try {
      const res = await procurement.listRequisitions("Approved");
      if (res.data?.success) {
        const prs: PurchaseRequisition[] = res.data.data || [];
        setApprovedPRs(prs);
      }
    } catch {
      setErrors((p) => ({ ...p, general: "Purchase Requisitions could not be loaded. Please retry." }));
    } finally {
      setLoadingPRs(false);
    }
  };

  const fetchNextPoNumber = async () => {
    try {
      const res = await procurement.nextOrderNumber();
      if (res.data?.success) {
        setNextPoNumber(res.data.data);
      }
    } catch {
      // Non-critical preview number
    }
  };

  const fetchEligibleSuppliers = async (pr: PurchaseRequisition) => {
    setLoadingSuppliers(true);
    setEligibleSuppliers([]);
    try {
      const itemIds = (pr.items || []).map((i) => i.itemId);
      const supplierMap: Map<number, { supplierId: number; supplierName: string; email?: string; contactPerson?: string; address?: string }> = new Map();
      await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const res = await actionResponse(supplierItemsByItem(itemId));
            if (res.data?.success) {
              (res.data.data || []).forEach((s: any) => {
                if (!supplierMap.has(s.supplierId)) {
                  supplierMap.set(s.supplierId, {
                    supplierId: s.supplierId,
                    supplierName: s.supplierName,
                    email: s.email,
                    contactPerson: s.contactPerson,
                    address: s.address,
                  });
                }
              });
            }
          } catch {}
        })
      );
      setEligibleSuppliers(Array.from(supplierMap.values()));
    } catch {
      setErrors((p) => ({ ...p, general: "Supplier choices could not be loaded. Please retry." }));
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchItemsForSupplier = async (supplierId: number, pr: PurchaseRequisition) => {
    setLoadingItems(true);
    try {
      const [catalogRes, orderedRes] = await Promise.all([
        actionResponse(supplierItemsBySupplier(supplierId)),
        procurement.orderedQuantities(pr.prId),
      ]);

      const catalog: any[] = catalogRes.data?.success ? catalogRes.data.data || [] : [];
      const orderedMap: Record<number, number> = {};
      if (orderedRes.data?.success && Array.isArray(orderedRes.data.data)) {
        orderedRes.data.data.forEach((o: any) => {
          orderedMap[o.itemId] = Number(o.orderedQty) || 0;
        });
      }

      const rows: ItemRow[] = (pr.items || []).map((prItem) => {
        const catalogEntry = catalog.find((c) => c.itemId === prItem.itemId);
        const alreadyOrdered = orderedMap[prItem.itemId] || 0;
        const remaining = Math.max(0, prItem.requestedQuantity - alreadyOrdered);

        return {
          itemId: prItem.itemId,
          itemName: prItem.itemName,
          uomName: prItem.uomName || catalogEntry?.purchaseUomName || "Unit",
          purchaseUomId: catalogEntry?.purchaseUomId || prItem.purchaseUomId || 1,
          alreadyOrdered,
          requestedQty: prItem.requestedQuantity,
          remaining,
          orderQty: remaining > 0 ? String(remaining) : "0",
        };
      });

      setItemRows(rows);
    } catch {
      setErrors((p) => ({ ...p, general: "Items could not be loaded. Please retry." }));
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectPR = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setSelectedSupplierId(null);
    setItemRows([]);
    fetchEligibleSuppliers(pr);
    setStep(2);
  };

  const handleSelectSupplier = (supplierId: number) => {
    setSelectedSupplierId(supplierId);
    if (selectedPR) fetchItemsForSupplier(supplierId, selectedPR);
    fetchNextPoNumber();
    setStep(3);
  };

  const updateRow = (idx: number, value: string) => {
    if (value !== "" && !/^\d*\.?\d{0,3}$/.test(value)) return;
    setItemRows((prev) => prev.map((row, i) => (i === idx ? { ...row, orderQty: value } : row)));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    const hasAnyQty = itemRows.some((row) => (parseFloat(row.orderQty) || 0) > 0);
    if (!hasAnyQty) {
      errs.items = "Please enter an order quantity greater than 0 for at least one item.";
    }
    itemRows.forEach((row, idx) => {
      const qty = parseFloat(row.orderQty);
      if (!row.orderQty || isNaN(qty) || qty < 0) {
        errs[`qty_${idx}`] = "Required";
      } else if (qty > row.remaining) {
        errs[`qty_${idx}`] = `Cannot exceed remaining balance (${row.remaining})`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isStep3Valid = useMemo(() => {
    const activeRows = itemRows.filter((r) => (parseFloat(r.orderQty) || 0) > 0);
    if (activeRows.length === 0) return false;
    return activeRows.every((r) => {
      const qty = parseFloat(r.orderQty) || 0;
      if (!isEdit && qty > r.remaining) return false;
      return true;
    });
  }, [itemRows, isEdit]);

  const selectedSupplier = eligibleSuppliers.find((s) => s.supplierId === selectedSupplierId);

  const handleConfirmSendToSupplier = async () => {
    // Open popup tab synchronously on user click to ensure browser popup blocker does not block it
    const gmailTab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

    setSubmitting(true);
    setErrors({});
    try {
      const activeRows = itemRows.filter((row) => (parseFloat(row.orderQty) || 0) > 0);
      const payload = {
        prId: selectedPR?.prId ?? initialPo?.prId ?? null,
        supplierId: selectedSupplierId,
        expectedArrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        paymentType: "Cash",
        requestedBy: staff.name,
        initialStatus: "Pending Approval",
        items: activeRows.map((row) => ({
          itemId: row.itemId,
          poItemQuantity: parseFloat(row.orderQty),
          purchaseUomId: row.purchaseUomId || undefined,
        })),
      };

      const res = isEdit && initialPo?.poId
        ? await procurement.updateOrder(initialPo.poId, payload)
        : await procurement.createOrder(payload);

      if (res.data?.success) {
        const created: PurchaseOrderPO = res.data.data;
        const poNum = created?.poNumber || nextPoNumber || "Purchase Order";

        // Construct Gmail Web Compose URL (opens in new tab as draft)
        const supplierEmail = selectedSupplier?.email || "";
        const googleDocsFormUrl = "https://docs.google.com/forms/";
        const emailSubject = `Purchase Order ${poNum} — Bren Raphael's Ube Jam & Halaya`;
        const emailBody =
          `Dear ${selectedSupplier?.contactPerson || selectedSupplier?.supplierName || "Supplier"},\n\n` +
          `Good day.\n\n` +
          `Please find our Purchase Order ${poNum} referencing Purchase Requisition ${selectedPR?.prNumber || ""}.\n\n` +
          `Kindly review the order particulars and submit your accommodation confirmation and pricing through our form:\n` +
          `${googleDocsFormUrl}\n\n` +
          `In the acknowledgment form, please confirm:\n` +
          `1. Items and quantities you can accommodate\n` +
          `2. Unit price and total order amount\n` +
          `3. Authorized approver name and approval date\n\n` +
          `We have attached our official Purchase Order document.\n\n` +
          `Thank you,\n` +
          `${staff.name || "Vince Neil Madeja"}\n` +
          `Inventory Management\n` +
          `Bren Raphael's Ube Jam & Halaya`;

        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supplierEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        
        // Auto-download the printable Purchase Order PDF immediately
        try {
          await downloadPurchaseOrderPdf(created);
        } catch (e) {
          console.error("Auto download PDF failed:", e);
        }

        // Navigate the pre-opened tab directly to the Gmail compose draft
        if (gmailTab && !gmailTab.closed) {
          gmailTab.location.href = gmailUrl;
        } else {
          try {
            window.open(gmailUrl, "_blank", "noopener,noreferrer");
          } catch {
            // Fallback handled by in-modal button
          }
        }

        // Store created order and URL for in-modal actions
        setGmailComposeUrl(gmailUrl);
        setCreatedOrder(created);
      } else {
        if (gmailTab && !gmailTab.closed) gmailTab.close();
        setErrors((p) => ({ ...p, general: res.data?.message || "Failed to create Purchase Order." }));
      }
    } catch (e: any) {
      if (gmailTab && !gmailTab.closed) gmailTab.close();
      setErrors((p) => ({ ...p, general: e?.message || "Failed to create Purchase Order." }));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPRs = useMemo(() => {
    const s = prSearch.toLowerCase();
    return approvedPRs.filter(
      (pr) =>
        !s ||
        pr.prNumber.toLowerCase().includes(s) ||
        pr.requestedBy?.toLowerCase().includes(s) ||
        pr.department?.toLowerCase().includes(s)
    );
  }, [approvedPRs, prSearch]);

  return (
    <ModalWrapper
      open={open}
      title={
        createdOrder
          ? "Purchase Order Draft Ready"
          : isReviewing
          ? "Review Purchase Order"
          : isEdit
          ? `Edit Purchase Order — ${initialPo?.poNumber}`
          : "Create Purchase Order"
      }
      onClose={() => {
        if (createdOrder) {
          onSuccess(createdOrder);
        }
        setIsReviewing(false);
        setCreatedOrder(null);
        onClose();
      }}
      size={createdOrder ? "max-w-xl" : isReviewing ? "max-w-3xl" : "max-w-5xl"}
    >
      <div className="space-y-6">
        {errors.general && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
            <span className="font-medium">{errors.general}</span>
            <button
              type="button"
              onClick={() =>
                setErrors((prev) => {
                  const c = { ...prev };
                  delete c.general;
                  return c;
                })
              }
              className="font-bold underline ml-2 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Post-Submit Confirmation: Gmail Draft Opened in New Tab */}
        {createdOrder ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground">
                Purchase Order {createdOrder.poNumber} Created!
              </h3>
              <div className="inline-block mt-1 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Status: Pending Approval
              </div>
              <p className="text-xs text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                Your Purchase Order has been placed in the <strong>Pending Approval</strong> tab. A new tab has opened with your Gmail draft containing the email text and Google Docs / Form link. The official Purchase Order PDF has also been automatically downloaded to your computer — simply attach it in Gmail and click Send!
              </p>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm text-center cursor-pointer"
              >
                Open Gmail Draft in New Tab
              </a>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (createdOrder) downloadPurchaseOrderPdf(createdOrder);
                }}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Download Purchase Order PDF
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onSuccess(createdOrder);
                  onClose();
                }}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Close &bull; Go to Pending Approval Tab
              </Button>
            </div>
          </div>
        ) : isReviewing ? (
          /* In-Modal Review Step */
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span>
                Please review the details below. Confirming will set status to <strong>Pending Approval</strong>, generate your official printable document, and launch a new tab with your Gmail draft so you can review the email and form link before sending.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-muted/20 border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Purchase Requisition Reference</span>
                <span className="font-mono font-bold text-foreground">{selectedPR?.prNumber || initialPo?.prNumber || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Supplier / Vendor</span>
                <span className="font-bold text-foreground">{selectedSupplier?.supplierName || initialPo?.supplierName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Supplier Email</span>
                <span className="font-medium text-foreground">{selectedSupplier?.email || "No email registered"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Purchase Order Number</span>
                <span className="font-mono font-semibold text-foreground">{nextPoNumber || "Auto-assigned"}</span>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold">PARTICULARS</th>
                    <th className="px-4 py-2.5 text-left font-bold">Unit of Measure</th>
                    <th className="px-4 py-2.5 text-right font-bold">ORDER QUANTITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itemRows
                    .filter((row) => (parseFloat(row.orderQty) || 0) > 0)
                    .map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5 font-medium text-foreground">{row.itemName}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.uomName}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                          {row.orderQty}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Review Footer */}
            <div className="flex justify-end gap-3 pt-5 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReviewing(false)}
                disabled={submitting}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSendToSupplier}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Opening Gmail..." : "Submit and Open Gmail Draft"}
              </Button>
            </div>
          </div>
        ) : (
          /* Step Progress & Normal Steps */
          <>
            {!isEdit && (
              <div className="flex items-center gap-0">
                {[1, 2, 3].map((s) => (
                  <React.Fragment key={s}>
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                        step === s
                          ? "bg-primary text-primary-foreground"
                          : step > s
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                          : "text-muted-foreground bg-muted/40"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                        {step > s ? "✓" : s}
                      </span>
                      <span>
                        {s === 1
                          ? "Select Purchase Requisition"
                          : s === 2
                          ? "Select Supplier"
                          : "Order Quantities"}
                      </span>
                    </div>
                    {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-1 shrink-0" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Step 1: Select Approved Purchase Requisition */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Select an Approved Purchase Requisition
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Choose an approved requisition to begin creating a Purchase Order.
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search requisitions..."
                      value={prSearch}
                      onChange={(e) => setPrSearch(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden max-h-96 overflow-y-auto bg-card">
                  {loadingPRs ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">Loading requisitions...</div>
                  ) : filteredPRs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No approved purchase requisitions available for ordering.
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[11px] sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-bold">REQUISITION NO.</th>
                          <th className="px-4 py-2.5 text-left font-bold">REQUESTED BY</th>
                          <th className="px-4 py-2.5 text-left font-bold">DEPARTMENT</th>
                          <th className="px-4 py-2.5 text-left font-bold">PURPOSE</th>
                          <th className="px-4 py-2.5 text-right font-bold">ITEMS</th>
                          <th className="px-4 py-2.5 text-center font-bold">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredPRs.map((pr) => (
                          <tr key={pr.prId} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-foreground">{pr.prNumber}</td>
                            <td className="px-4 py-3 text-muted-foreground">{pr.requestedBy}</td>
                            <td className="px-4 py-3 text-muted-foreground">{pr.department}</td>
                            <td className="px-4 py-3 text-muted-foreground">{pr.purpose || pr.requestType}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium">
                              {pr.items?.length || 0}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSelectPR(pr)}
                                className="h-7 px-3 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Select
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Select Supplier */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Select Supplier for {selectedPR?.prNumber}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Choose the vendor or supplier to send this Purchase Order to.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-xs rounded-xl"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back to Requisitions
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-96 overflow-y-auto p-1">
                  {loadingSuppliers ? (
                    <div className="col-span-full p-8 text-center text-xs text-muted-foreground">
                      Loading suppliers...
                    </div>
                  ) : eligibleSuppliers.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-xs text-muted-foreground">
                      No active suppliers found.
                    </div>
                  ) : (
                    eligibleSuppliers.map((sup) => (
                      <div
                        key={sup.supplierId}
                        onClick={() => handleSelectSupplier(sup.supplierId)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-primary/50 hover:bg-muted/30 ${
                          selectedSupplierId === sup.supplierId
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-foreground uppercase">{sup.supplierName}</h4>
                          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                        {sup.contactPerson && (
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            Contact: <span className="text-foreground font-medium">{sup.contactPerson}</span>
                          </p>
                        )}
                        {sup.email && (
                          <p className="text-[11px] text-muted-foreground">
                            Email: <span className="font-mono text-foreground">{sup.email}</span>
                          </p>
                        )}
                        {sup.address && (
                          <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">
                            {sup.address}
                          </p>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          className="w-full mt-3 h-7 text-xs rounded-lg"
                        >
                          Select Supplier
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Order Quantities */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Specify Order Quantities
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Supplier: <strong className="text-foreground">{selectedSupplier?.supplierName}</strong> &bull; Purchase Requisition: <strong className="text-foreground">{selectedPR?.prNumber || initialPo?.prNumber}</strong>
                    </p>
                  </div>
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(2)}
                      className="flex items-center gap-1 text-xs rounded-xl"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Change Supplier
                    </Button>
                  )}
                </div>

                {errors.items && (
                  <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    {errors.items}
                  </div>
                )}

                <div className="border border-border rounded-xl overflow-x-auto bg-card">
                  {loadingItems ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">Loading items...</div>
                  ) : itemRows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No items available from this supplier for the selected requisition.
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[11px]">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-bold">PARTICULARS</th>
                          <th className="px-4 py-2.5 text-left font-bold">Unit of Measure</th>
                          <th className="px-4 py-2.5 text-center font-bold">REQUESTED</th>
                          <th className="px-4 py-2.5 text-center font-bold">ALREADY ORDERED</th>
                          <th className="px-4 py-2.5 text-center font-bold">REMAINING</th>
                          <th className="px-4 py-2.5 text-right font-bold w-36">ORDER QUANTITY *</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {itemRows.map((row, idx) => {
                          const isFullyOrdered = row.remaining <= 0;
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${
                                isFullyOrdered ? "opacity-50 bg-muted/10" : "hover:bg-muted/10"
                              }`}
                            >
                              <td className="px-4 py-3 font-semibold text-foreground uppercase">
                                {row.itemName}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{row.uomName}</td>
                              <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                                {row.requestedQty}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                                {row.alreadyOrdered}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {row.remaining}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  max={row.remaining}
                                  step="any"
                                  value={row.orderQty}
                                  disabled={isFullyOrdered}
                                  onChange={(e) => updateRow(idx, e.target.value)}
                                  className={`h-8 w-28 ml-auto text-right font-mono font-bold text-xs bg-card ${
                                    errors[`qty_${idx}`] ? "border-destructive" : "border-border"
                                  }`}
                                />
                                {errors[`qty_${idx}`] && (
                                  <p className="text-[10px] text-destructive mt-0.5">
                                    {errors[`qty_${idx}`]}
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Step 3 Footer Action Buttons */}
                <div className="flex justify-end gap-3 pt-5 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={submitting || !isStep3Valid}
                    onClick={() => {
                      if (validate()) setIsReviewing(true);
                    }}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Review Purchase Order
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalWrapper>
  );
}
