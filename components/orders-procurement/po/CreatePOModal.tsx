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
  sendPurchaseOrderEmail,
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

        // Auto-download the printable Purchase Order PDF immediately
        try {
          await downloadPurchaseOrderPdf(created);
        } catch (e) {
          console.error("Auto download PDF failed:", e);
        }

        // Reconstruct Email Body asking all questions directly in the email (No links)
        const itemsList = activeRows
          .map((r, i) => `  ${i + 1}. ${r.itemName.toUpperCase()} — ${r.orderQty} ${r.uomName}`)
          .join("\n");

        const itemAccommodationLines = activeRows
          .map((r) => `  • ${r.itemName} (Requested: ${r.orderQty} ${r.uomName})\n    Accommodated Quantity: [                       ]`)
          .join("\n\n");

        const itemPricingLines = activeRows
          .map((r) => `  • ${r.itemName}: ₱[                   ] per ${r.uomName}`)
          .join("\n");

        const supplierContact = selectedSupplier?.contactPerson
          ? `${selectedSupplier.contactPerson} (${selectedSupplier.supplierName})`
          : selectedSupplier?.supplierName || "Valued Supplier Partner";

        const targetEmail = recipientEmail.trim() || selectedSupplier?.email || "";
        const supplierEmail = targetEmail;
        const emailSubject = `Purchase Order ${poNum} — Bren Raphael's Ube Jam & Halaya`;
        const emailBody =
          `Dear ${supplierContact},\n\n` +
          `Greetings from Bren Raphael's Ube Jam & Halaya!\n\n` +
          `We are formally issuing Purchase Order ${poNum} referencing Purchase Requisition ${selectedPR?.prNumber || "N/A"}.\n\n` +
          `Please find our official Purchase Order document attached (${poNum}.pdf) for your complete reference and record.\n\n` +
          `------------------------------------------------------------\n` +
          `ORDER PARTICULARS REQUESTED:\n` +
          `------------------------------------------------------------\n` +
          `${itemsList}\n\n` +
          `------------------------------------------------------------\n` +
          `SUPPLIER ORDER ACKNOWLEDGMENT & QUOTATION\n` +
          `(Kindly click "Reply" to this email and fill out the details below)\n` +
          `------------------------------------------------------------\n\n` +
          `[1] ORDER ACCOMMODATION:\n` +
          `Can your company fulfill the requested items and quantities in full?\n` +
          `Please specify your accommodated quantities for each line item below:\n\n` +
          `${itemAccommodationLines}\n\n` +
          `[2] QUOTED UNIT PRICING & FINAL ORDER TOTAL:\n` +
          `Please provide your official unit pricing for each item:\n\n` +
          `${itemPricingLines}\n\n` +
          `  >> ESTIMATED TOTAL ORDER AMOUNT: ₱[                   ]\n\n` +
          `[3] COMMITTED DELIVERY DATE:\n` +
          `  • Target / Estimated Delivery Date: [ YYYY-MM-DD ]\n` +
          `  • Delivery Lead Time Notes:         [                       ]\n\n` +
          `[4] AUTHORIZED SUPPLIER REPRESENTATIVE:\n` +
          `  • Authorized Approver Name: [                               ]\n` +
          `  • Designation / Position:   [                               ]\n` +
          `  • Contact Number:           [                               ]\n` +
          `  • Confirmation Date & Time: [                               ]\n\n` +
          `------------------------------------------------------------\n\n` +
          `Thank you very much, and we look forward to your confirmation.\n\n` +
          `Warm regards,\n\n` +
          `${staff.name || "Vince Neil Madeja"}\n` +
          `Inventory Management & Procurement\n` +
          `Bren Raphael's Ube Jam & Halaya`;

        // Construct Gmail Web Compose URL
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supplierEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

        // Automatically open the Gmail Web compose draft in a new tab
        if (typeof window !== "undefined") {
          window.open(gmailUrl, "_blank");
        }

        // Also attempt direct server email dispatch if SMTP is configured
        try {
          await actionResponse(
            sendPurchaseOrderEmail({
              poNumber: poNum,
              supplierEmail,
              supplierName: selectedSupplier?.supplierName || "Supplier",
              emailSubject,
              emailBody,
            })
          );
        } catch (emailErr) {
          console.error("Automated email dispatch error:", emailErr);
        }

        // Keep modal open on the clean Review & Send in Gmail screen!
        setGmailComposeUrl(gmailUrl);
        setCreatedOrder(created);
        setIsConfirmedSent(false);
        setIsReviewing(false);
      } else {
        setErrors((p) => ({ ...p, general: res.data?.message || "Failed to create Purchase Order." }));
      }
    } catch (e: any) {
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
      if (res.data?.success || res.data) {
        setIsConfirmedSent(true);
      } else {
        setErrors((p) => ({ ...p, general: "Failed to update order status." }));
      }
    } catch (e: any) {
      setErrors((p) => ({ ...p, general: e?.message || "Failed to update order status." }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!createdOrder) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await procurement.setOrderStatus(createdOrder.poId, { status: "Cancelled" });
    } catch (e) {
      console.error("Discard failed:", e);
    } finally {
      setSubmitting(false);
      setCreatedOrder(null);
      setIsConfirmedSent(false);
      onClose();
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
          ? isConfirmedSent
            ? "Purchase Order Sent"
            : "Review & Send in Gmail"
          : isReviewing
          ? "Review Purchase Order"
          : isEdit
          ? `Edit Purchase Order — ${initialPo?.poNumber}`
          : "Create Purchase Order"
      }
      onClose={() => {
        if (createdOrder && isConfirmedSent) {
          onSuccess(createdOrder);
        }
        setIsReviewing(false);
        setCreatedOrder(null);
        setIsConfirmedSent(false);
        onClose();
      }}
      size={createdOrder ? "max-w-2xl" : isReviewing ? "max-w-3xl" : "max-w-5xl"}
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
          /* Post-Submit Confirmation: Review & Send in Gmail */
          <div className="w-full min-w-0 text-center py-2">
            {!isConfirmedSent ? (
              /* Stage 1: Waiting for user to review & send in Gmail */
              <div className="w-full min-w-0 flex flex-col items-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Mail className="w-7 h-7" />
                </div>

                <div className="w-full space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Draft Opened in Gmail &bull; Not Sent Yet
                  </span>
                  <h3 className="text-xl font-bold text-foreground">
                    Review &amp; Send in Gmail &mdash; {createdOrder.poNumber}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    We prepared your official Gmail draft and opened it in a new browser tab. Your Purchase Order PDF (<strong>{createdOrder.poNumber}.pdf</strong>) has also been automatically downloaded to your device.
                  </p>
                </div>

                {/* Steps Callout Box */}
                <div className="w-full rounded-xl border border-border bg-muted/40 p-4 text-left space-y-2.5">
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">1</span>
                    Next Steps in Gmail:
                  </div>
                  <ol className="space-y-2 text-xs text-muted-foreground pl-1">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-foreground shrink-0">&bull;</span>
                      <span>Switch to the opened <strong>Gmail tab</strong> and review the drafted order particulars and questionnaire.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-foreground shrink-0">&bull;</span>
                      <span>Drag and drop the downloaded <strong>{createdOrder.poNumber}.pdf</strong> into your Gmail draft to attach it.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-foreground shrink-0">&bull;</span>
                      <span>Click <strong>Send</strong> inside Gmail to dispatch the order to <strong>{selectedSupplier?.supplierName || "the supplier"}</strong>.</span>
                    </li>
                  </ol>
                </div>

                {/* Order Details & Supplier Form Link Summary */}
                <div className="w-full rounded-xl border border-border bg-card p-4 text-left text-xs space-y-3 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground block uppercase">Recipient Email</span>
                      <span className="font-semibold text-foreground break-all">
                        {recipientEmail || selectedSupplier?.email || "No email registered"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground block uppercase">Supplier Contact</span>
                      <span className="font-semibold text-foreground">
                        {selectedSupplier?.contactPerson || selectedSupplier?.supplierName || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[11px] font-medium text-muted-foreground block uppercase mb-1">
                      Supplier Acknowledgment Link (Included in Email Draft):
                    </span>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/80 font-mono text-[11px] text-foreground min-w-0">
                      <span className="truncate flex-1 select-all">
                        {typeof window !== "undefined" ? window.location.origin : ""}/supplier-acknowledgment?poNumber={createdOrder.poNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${typeof window !== "undefined" ? window.location.origin : ""}/supplier-acknowledgment?poNumber=${encodeURIComponent(createdOrder.poNumber)}`;
                          if (typeof navigator !== "undefined" && navigator.clipboard) {
                            navigator.clipboard.writeText(url);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-card border border-border text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedLink ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stage 1 Action Buttons */}
                <div className="w-full space-y-3 pt-2">
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={handleMarkAsSentInGmail}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? "Confirming..." : "I Have Sent the Email in Gmail • Set to Pending Approval"}
                  </Button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                    <a
                      href={gmailComposeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      Re-open Gmail Draft
                    </a>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => downloadPurchaseOrderPdf(createdOrder)}
                      className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-foreground" />
                      Download PDF Again
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={handleDiscardDraft}
                      className="h-10 px-3 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Discard Draft
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Stage 2: Confirmed Sent -> Placed in Pending Approval */
              <div className="w-full min-w-0 flex flex-col items-center space-y-5 py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="w-full space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    Status: Pending Approval
                  </span>
                  <h3 className="text-xl font-bold text-foreground">
                    Purchase Order {createdOrder.poNumber} Sent to Supplier!
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Your confirmation has been saved. This Purchase Order is now officially placed in the <strong>Pending Approval</strong> tab while awaiting the supplier&apos;s quotation and acknowledgment.
                  </p>
                </div>

                <div className="w-full max-w-md mx-auto pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      onSuccess(createdOrder);
                      onClose();
                    }}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                  >
                    Done &bull; Go to Pending Approval Tab
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : isReviewing ? (
          /* In-Modal Review Step */
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span>
                Please review the particulars below. Confirming will create the Purchase Order, automatically download your official PDF document, and automatically dispatch the order details and questionnaire directly to the supplier&apos;s registered email.
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

            {/* Transmission Preview Banner */}
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-2">
              <span className="font-semibold text-primary block">
                Automated Email Transmission:
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
                  Purchase Order {nextPoNumber || "Auto-assigned"} — Bren Raphael&apos;s Ube Jam &amp; Halaya
                </p>
                <p>
                  <strong className="text-foreground">Attachment:</strong>{" "}
                  Purchase-Order-{nextPoNumber || "PO"}.pdf (Attached automatically)
                </p>
                <p>
                  <strong className="text-foreground">Dispatch:</strong>{" "}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Dispatched automatically upon submission
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
                {submitting ? "Sending Order..." : "Confirm & Send to Supplier"}
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
