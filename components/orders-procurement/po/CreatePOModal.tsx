"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Users,
  Mail,
  CheckCircle2,
  Download,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { PurchaseRequisition, PurchaseOrderPO } from "../types";
import { useStaff } from "@/context/StaffContext";
import { procurement } from "@/lib/orders/client";
import {
  supplierItemsByItem,
  supplierItemsBySupplier,
  getSupplierForOrder,
} from "@/app/actions/orders/catalog";
import { actionResponse } from "@/lib/resources/action-response";
import { downloadPurchaseOrderPdf } from "./downloadPurchaseOrderPdf";

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
  onDraftDiscarded?: (poNumber?: string) => void;
}

export function CreatePOModal({
  open,
  initialPrId,
  initialPo,
  isEdit = false,
  onClose,
  onSuccess,
  onDraftDiscarded,
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
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  // Post-submit success state (Draft opened in Gmail)
  const [createdOrder, setCreatedOrder] = useState<PurchaseOrderPO | null>(null);
  const [gmailComposeUrl, setGmailComposeUrl] = useState<string>("");
  const [isConfirmedSent, setIsConfirmedSent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [selectedSupplierDetails, setSelectedSupplierDetails] = useState<{
    supplierId: number;
    supplierName: string;
    email?: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      if (isEdit && initialPo) {
        setStep(3);
        setNextPoNumber(initialPo.poNumber);
        setSelectedSupplierId(initialPo.supplierId);
        setRecipientEmail(initialPo.supplierEmail || "");
        if (initialPo.supplierId) {
          actionResponse(getSupplierForOrder(initialPo.supplierId)).then((res) => {
            if (res.data?.success && res.data.data) {
              setSelectedSupplierDetails(res.data.data);
              if (res.data.data.email) {
                setRecipientEmail(res.data.data.email);
              }
            }
          });
        }
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
      } else {
        setStep(1);
        setPrSearch("");
        setSelectedPR(null);
        setSelectedSupplierId(null);
        setSelectedSupplierDetails(null);
        setItemRows([]);
        setRecipientEmail("");
        setErrors({});
        setIsReviewing(false);
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

  const handleSelectSupplier = async (supplierId: number) => {
    setSelectedSupplierId(supplierId);
    const sup = eligibleSuppliers.find((s) => s.supplierId === supplierId);
    if (sup?.email) {
      setRecipientEmail(sup.email);
    }
    try {
      const res = await actionResponse(getSupplierForOrder(supplierId));
      if (res.data?.success && res.data.data) {
        setSelectedSupplierDetails(res.data.data);
        if (res.data.data.email) {
          setRecipientEmail(res.data.data.email);
        }
      }
    } catch {
      // Fallback already assigned
    }
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

  const selectedSupplier =
    selectedSupplierDetails ||
    eligibleSuppliers.find((s) => s.supplierId === selectedSupplierId) ||
    (initialPo
      ? {
          supplierId: initialPo.supplierId,
          supplierName: initialPo.supplierName,
          email: initialPo.supplierEmail,
          contactPerson: initialPo.supplierContactPerson,
          address: initialPo.supplierAddress,
        }
      : null);

  const handleConfirmSendToSupplier = async () => {
    setSubmitting(true);
    setErrors({});
    // Open tab synchronously on click so the browser never blocks it as a popup
    const gmailTab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
    try {
      const activeRows = itemRows.filter((row) => (parseFloat(row.orderQty) || 0) > 0);
      const payload = {
        prId: selectedPR?.prId ?? initialPo?.prId ?? null,
        supplierId: selectedSupplierId,
        expectedArrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        paymentType: "Cash",
        requestedBy: staff.name,
        initialStatus: "Draft",
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
        const prRef = selectedPR?.prNumber || initialPo?.prNumber || "N/A";

        // Build clean, formal email body (message + questionnaire in one email)
        const orderDetailsLines = activeRows
          .map((r, i) => `  ${i + 1}. ${r.itemName} ............ ${r.orderQty} ${r.uomName}`)
          .join("\n");

        const supplyQtyLines = activeRows
          .map((r) => `       ${r.itemName}: ______ ${r.uomName}`)
          .join("\n");

        const unitPriceLines = activeRows
          .map((r) => `       ${r.itemName}: PHP ______ per ${r.uomName}`)
          .join("\n");

        const contactName = selectedSupplier?.contactPerson
          ? `Mr./Ms. ${selectedSupplier.contactPerson}`
          : selectedSupplier?.supplierName || "Valued Supplier Partner";
        const supplierCompany = selectedSupplier?.supplierName || "your company";

        const supplierEmail = recipientEmail.trim() || selectedSupplier?.email || "";
        const emailSubject = `Purchase Order ${poNum} | Bren Raphael's Ube Jam & Halaya`;
        const emailBody =
          `Dear ${contactName},\n\n` +
          `Good day!\n\n` +
          `On behalf of Bren Raphael's Ube Jam & Halaya, we are pleased to issue Purchase Order No. ${poNum} (Ref. ${prRef}) to ${supplierCompany}. The official Purchase Order document (${poNum}.pdf) is attached to this email.\n\n` +
          `ORDER DETAILS\n` +
          `${orderDetailsLines}\n\n` +
          `To proceed, kindly reply to this email with the following information:\n\n` +
          `  1. Quantity you can supply for each item\n` +
          `${supplyQtyLines}\n` +
          `  2. Unit price for each item\n` +
          `${unitPriceLines}\n` +
          `  3. Total order amount: PHP ______\n` +
          `  4. Expected delivery date: ______\n` +
          `  5. Name, position and contact number of the person confirming this order: ______\n\n` +
          `Should you have any questions, please feel free to reply to this email.\n\n` +
          `Thank you, and we look forward to your confirmation.\n\n` +
          `Respectfully,\n\n` +
          `${staff.name || "Vince Neil Madeja"}\n` +
          `Inventory Management & Procurement\n` +
          `Bren Raphael's Ube Jam & Halaya`;

        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supplierEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

        if (gmailTab && !gmailTab.closed) {
          gmailTab.location.href = gmailUrl;
        } else if (typeof window !== "undefined") {
          window.open(gmailUrl, "_blank");
        }

        // Auto-download the printable Purchase Order PDF so the user can attach it
        try {
          await downloadPurchaseOrderPdf(created);
        } catch (e) {
          console.error("Auto download PDF failed:", e);
        }

        setGmailComposeUrl(gmailUrl);
        setCreatedOrder(created);
        setIsConfirmedSent(false);
        setIsReviewing(false);
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

  const handleMarkAsSentInGmail = async () => {
    if (!createdOrder) return;
    setSubmitting(true);
    try {
      const res = await procurement.setOrderStatus(createdOrder.poId, { status: "Pending Approval" });
      const updatedOrder: PurchaseOrderPO = res.data?.data || { ...createdOrder, status: "Pending Approval" };
      setIsConfirmedSent(true);
      onSuccess(updatedOrder);
      setCreatedOrder(null);
      onClose();
    } catch (e: any) {
      setErrors((p) => ({ ...p, general: e?.message || "Failed to mark Purchase Order as sent." }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrCloseWhileWaiting = async () => {
    const unsentOrder = createdOrder && !isConfirmedSent ? createdOrder : null;
    setIsReviewing(false);
    setCreatedOrder(null);
    setIsConfirmedSent(false);
    if (unsentOrder?.poId) {
      try {
        await procurement.discardDraftOrder(unsentOrder.poId);
      } catch (e) {
        console.error("Failed to discard unsent draft PO:", e);
      }
      onDraftDiscarded?.(unsentOrder.poNumber);
    }
    onClose();
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
          ? "Review & Send in Gmail"
          : isReviewing
          ? "Review Purchase Order"
          : isEdit
          ? `Edit Purchase Order — ${initialPo?.poNumber}`
          : "Create Purchase Order"
      }
      onClose={() => {
        if (createdOrder && !isConfirmedSent) {
          void handleCancelOrCloseWhileWaiting();
          return;
        }
        setIsReviewing(false);
        setCreatedOrder(null);
        setIsConfirmedSent(false);
        onClose();
      }}
      size={createdOrder || isReviewing ? "max-w-3xl" : "max-w-5xl"}
    >
      <div className="w-full min-w-0 space-y-6">
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

        {createdOrder ? (
          /* Waiting for Gmail Send Step (matches Review Purchase Order layout) */
          <div className="w-full space-y-5">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Gmail draft opened in a new tab — <strong>not sent yet</strong>. Your PDF (<strong>{createdOrder.poNumber}.pdf</strong>) has been downloaded. This PO will only move to <strong>Pending Approval</strong> after you click <strong>I Have Already Sent the Email</strong>. Closing or cancelling rolls it back so you can try again.
              </span>
            </div>

            {/* Summary Card (2x2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-card border border-border text-xs shadow-sm">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Purchase Order Number</span>
                <span className="font-mono font-bold text-foreground text-sm">{createdOrder.poNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Supplier / Vendor</span>
                <span className="font-bold text-foreground text-sm">{selectedSupplier?.supplierName || initialPo?.supplierName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Recipient Email</span>
                <span className="font-semibold text-foreground text-sm break-all">
                  {recipientEmail || selectedSupplier?.email || "No email registered"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Supplier Contact</span>
                <span className="font-semibold text-foreground text-sm">
                  {selectedSupplier?.contactPerson || selectedSupplier?.supplierName || "—"}
                </span>
              </div>
            </div>

            {/* Items Table (same as Review screen) */}
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

            {/* 3 Short Steps */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-xs space-y-2">
              <span className="font-semibold text-foreground uppercase tracking-wider block">
                Next Steps in Gmail:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Attach the downloaded <strong className="text-foreground">{createdOrder.poNumber}.pdf</strong> in the opened Gmail tab.
                </li>
                <li>
                  Review the formal email message and supplier questionnaire.
                </li>
                <li>
                  Click <strong className="text-foreground">Send</strong> in Gmail, then click <strong className="text-foreground">I Have Already Sent the Email</strong> below.
                </li>
              </ol>
            </div>

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-border mt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  Re-open Gmail
                </a>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadPurchaseOrderPdf(createdOrder)}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-foreground" />
                  Download PDF Again
                </Button>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={handleCancelOrCloseWhileWaiting}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={handleMarkAsSentInGmail}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Confirming..." : "I Have Already Sent the Email"}
                </Button>
              </div>
            </div>
          </div>
        ) : isReviewing ? (
          /* In-Modal Review Step */
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span>
                Please review the particulars below. Confirming will open Gmail in a new tab with the formal email &amp; questionnaire prepared, and download your official PO PDF for you to attach.
              </span>
            </div>

            {/* Supplier & Requisition Information Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-card border border-border text-xs shadow-sm">
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Purchase Requisition Reference</span>
                <span className="font-mono font-bold text-foreground text-sm">{selectedPR?.prNumber || initialPo?.prNumber || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Supplier / Vendor</span>
                <span className="font-bold text-foreground text-sm">{selectedSupplier?.supplierName || initialPo?.supplierName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] font-medium uppercase tracking-wider mb-1">Purchase Order Number</span>
                <span className="font-mono font-semibold text-foreground text-sm">{nextPoNumber || "Auto-assigned"}</span>
              </div>
              <div>
                <label className="text-muted-foreground block text-[11px] font-semibold uppercase tracking-wider mb-1">
                  Recipient Email (Supplier Registered Email):
                </label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Enter recipient email (e.g. supplier@company.com)"
                  className="h-8 text-xs bg-muted/20 border-border font-medium rounded-lg w-full"
                />
                {recipientEmail ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Supplier Email (Registered in System)
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block">
                    * No email was registered for this supplier. You can type one here so the order is emailed.
                  </span>
                )}
              </div>
            </div>

            {/* Gmail Draft Preview Banner */}
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-2">
              <span className="font-semibold text-primary block">
                Gmail Draft &amp; PDF Attachment:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <p>
                  <strong className="text-foreground">To:</strong>{" "}
                  <span className="font-mono text-foreground font-semibold">
                    {recipientEmail || "(None — please enter recipient above)"}
                  </span>
                </p>
                <p>
                  <strong className="text-foreground">Subject:</strong>{" "}
                  Purchase Order {nextPoNumber || "Auto-assigned"} | Bren Raphael&apos;s Ube Jam &amp; Halaya
                </p>
                <p>
                  <strong className="text-foreground">PDF Document:</strong>{" "}
                  {nextPoNumber || "PO"}.pdf (Downloaded automatically to attach in Gmail)
                </p>
                <p>
                  <strong className="text-foreground">Status:</strong>{" "}
                  <span className="text-primary font-semibold">
                    Moves to Pending Approval once you confirm sending in Gmail
                  </span>
                </p>
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
                {submitting ? "Preparing Gmail Draft..." : "Confirm & Send to Supplier"}
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
                      if (validate()) {
                        if (!recipientEmail && selectedSupplier?.email) {
                          setRecipientEmail(selectedSupplier.email);
                        }
                        setIsReviewing(true);
                      }
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
