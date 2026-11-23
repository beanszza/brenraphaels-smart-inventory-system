"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronDown,
  Mail,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
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

interface SupplierOption {
  supplierId: number;
  supplierName: string;
  email?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
}

export interface CreatePOFormProps {
  initialPrId?: number;
  initialPo?: PurchaseOrderPO | null;
  isEdit?: boolean;
  onClose: () => void;
  onSuccess: (createdPo?: PurchaseOrderPO) => void;
  onDraftDiscarded?: (poNumber?: string) => void;
  /** When true, omits outer page-container padding (e.g. when embedded inside ViewOrdersProcurement). */
  embedded?: boolean;
}

export interface CreatePOModalProps {
  open: boolean;
  initialPrId?: number;
  initialPo?: PurchaseOrderPO | null;
  isEdit?: boolean;
  onClose: () => void;
  onSuccess: (createdPo?: PurchaseOrderPO) => void;
  onDraftDiscarded?: (poNumber?: string) => void;
}

interface POFormBodyProps extends CreatePOFormProps {
  active: boolean;
  variant: "page" | "modal";
}

function POFormBody({
  active,
  initialPrId,
  initialPo,
  isEdit = false,
  onClose,
  onSuccess,
  onDraftDiscarded,
  variant,
  embedded = false,
}: POFormBodyProps) {
  const staff = useStaff();

  // Approved Purchase Requisitions
  const [approvedPRs, setApprovedPRs] = useState<PurchaseRequisition[]>([]);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
  const [loadingPRs, setLoadingPRs] = useState(false);

  // Eligible Suppliers for selected PR
  const [eligibleSuppliers, setEligibleSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Items & Quantities
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [removedRows, setRemovedRows] = useState<ItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [nextPoNumber, setNextPoNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isReviewing, setIsReviewing] = useState(false);

  // Post-submit success state (Draft opened in Gmail)
  const [createdOrder, setCreatedOrder] = useState<PurchaseOrderPO | null>(null);
  const [gmailComposeUrl, setGmailComposeUrl] = useState<string>("");
  const [isConfirmedSent, setIsConfirmedSent] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDiscardWaitingOpen, setConfirmDiscardWaitingOpen] = useState(false);

  const [selectedSupplierDetails, setSelectedSupplierDetails] =
    useState<SupplierOption | null>(null);

  useEffect(() => {
    if (!active) return;

    if (isEdit && initialPo) {
      setNextPoNumber(initialPo.poNumber);
      setSelectedSupplierId(initialPo.supplierId);
      if (initialPo.supplierId) {
        actionResponse(getSupplierForOrder(initialPo.supplierId)).then((res) => {
          if (res.data?.success && res.data.data) {
            setSelectedSupplierDetails(res.data.data);
          }
        });
      }
      setEligibleSuppliers([
        {
          supplierId: initialPo.supplierId,
          supplierName: initialPo.supplierName,
          email: initialPo.supplierEmail,
          contactPerson: initialPo.supplierContactPerson,
          phone: initialPo.supplierPhone,
          address: initialPo.supplierAddress,
        },
      ]);
      if (initialPo.prId) {
        setSelectedPR({
          prId: initialPo.prId,
          prNumber: initialPo.prNumber || `PR-${initialPo.prId}`,
          requestedBy: initialPo.requestedBy,
          department: "",
          requestDate: initialPo.orderDate,
          requiredDate: initialPo.expectedArrivalDate,
          status: "Approved",
          requestType: "",
          priority: "",
          purpose: "",
          items: [],
        });
      } else {
        setSelectedPR(null);
      }
      setItemRows(
        (initialPo.items || []).map((it) => ({
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
      setRemovedRows([]);
      setNotes(initialPo.adminNotes || "");
      setErrors({});
      setIsReviewing(false);
      setCreatedOrder(null);
      setIsConfirmedSent(false);
    } else {
      setSelectedPR(null);
      setEligibleSuppliers([]);
      setSelectedSupplierId(null);
      setSelectedSupplierDetails(null);
      setItemRows([]);
      setRemovedRows([]);
      setNotes("");
      setErrors({});
      setIsReviewing(false);
      setCreatedOrder(null);
      setIsConfirmedSent(false);
      fetchApprovedPRs();
      fetchNextPoNumber();
    }
  }, [active, isEdit, initialPo]);

  useEffect(() => {
    if (!isEdit && initialPrId && approvedPRs.length > 0 && !selectedPR) {
      const pr = approvedPRs.find((p) => p.prId === initialPrId);
      if (pr) {
        setSelectedPR(pr);
        fetchEligibleSuppliers(pr);
      }
    }
  }, [initialPrId, approvedPRs, isEdit, selectedPR]);

  const fetchApprovedPRs = async () => {
    setLoadingPRs(true);
    try {
      const res = await procurement.listRequisitions("Approved");
      if (res.data?.success) {
        const prs: PurchaseRequisition[] = res.data.data || [];
        // Ensure only PRs with remaining un-ordered balance > 0 are shown
        const checks = await Promise.all(
          prs.map(async (pr) => {
            const items = pr.items || [];
            if (items.length === 0) return null;
            try {
              const ordRes = await procurement.orderedQuantities(pr.prId);
              const orderedMap: Record<number, number> = {};
              if (ordRes.data?.success && Array.isArray(ordRes.data.data)) {
                (ordRes.data.data as { itemId: number; orderedQty?: number }[]).forEach((o) => {
                  orderedMap[o.itemId] = Number(o.orderedQty) || 0;
                });
              }
              const hasRemaining = items.some(
                (item) => Number(item.requestedQuantity) - (orderedMap[item.itemId] || 0) > 0
              );
              return hasRemaining ? pr : null;
            } catch {
              return pr;
            }
          })
        );
        setApprovedPRs(checks.filter((pr): pr is PurchaseRequisition => pr !== null));
      }
    } catch {
      setErrors((p) => ({
        ...p,
        general: "Purchase Requisitions could not be loaded. Please retry.",
      }));
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
      const orderedMap: Record<number, number> = {};
      try {
        const ordRes = await procurement.orderedQuantities(pr.prId);
        if (ordRes.data?.success && Array.isArray(ordRes.data.data)) {
          (ordRes.data.data as { itemId: number; orderedQty?: number }[]).forEach((o) => {
            orderedMap[o.itemId] = Number(o.orderedQty) || 0;
          });
        }
      } catch {}

      // Only look up suppliers for PR items that still have remaining un-ordered quantity > 0
      const remainingItemIds = (pr.items || [])
        .filter((i) => Number(i.requestedQuantity) - (orderedMap[i.itemId] || 0) > 0)
        .map((i) => i.itemId);
      const itemIds = remainingItemIds.length > 0 ? remainingItemIds : (pr.items || []).map((i) => i.itemId);

      const supplierMap: Map<number, SupplierOption> = new Map();
      await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const res = await actionResponse(supplierItemsByItem(itemId));
            if (res.data?.success) {
              ((res.data.data || []) as SupplierOption[]).forEach((s) => {
                if (!supplierMap.has(s.supplierId)) {
                  supplierMap.set(s.supplierId, {
                    supplierId: s.supplierId,
                    supplierName: s.supplierName,
                    email: s.email,
                    contactPerson: s.contactPerson,
                    phone: s.phone,
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
      setErrors((p) => ({
        ...p,
        general: "Supplier choices could not be loaded. Please retry.",
      }));
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

      const catalog: { itemId: number; purchaseUomName?: string; purchaseUomId?: number }[] =
        catalogRes.data?.success && Array.isArray(catalogRes.data.data) ? catalogRes.data.data : [];
      const suppliedItemIds = new Set(catalog.map((c) => Number(c.itemId)));
      const orderedMap: Record<number, number> = {};
      if (orderedRes.data?.success && Array.isArray(orderedRes.data.data)) {
        (orderedRes.data.data as { itemId: number; orderedQty?: number }[]).forEach((o) => {
          orderedMap[o.itemId] = Number(o.orderedQty) || 0;
        });
      }

      // Show only PR items that this supplier actually supplies (and still need ordering or are in their catalog)
      const rows: ItemRow[] = (pr.items || [])
        .filter((prItem) => suppliedItemIds.has(Number(prItem.itemId)))
        .map((prItem) => {
          const catalogEntry = catalog.find((c) => Number(c.itemId) === Number(prItem.itemId));
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
      setRemovedRows([]);
    } catch {
      setErrors((p) => ({ ...p, general: "Items could not be loaded. Please retry." }));
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectPR = (prIdValue: string) => {
    const id = Number(prIdValue);
    const pr = approvedPRs.find((p) => p.prId === id) || null;
    setSelectedPR(pr);
    setSelectedSupplierId(null);
    setSelectedSupplierDetails(null);
    setEligibleSuppliers([]);
    setItemRows([]);
    setRemovedRows([]);
    setErrors({});
    if (pr) {
      fetchEligibleSuppliers(pr);
    }
  };

  const handleSelectSupplier = async (supplierIdValue: string) => {
    const supplierId = Number(supplierIdValue);
    if (!supplierId) {
      setSelectedSupplierId(null);
      setSelectedSupplierDetails(null);
      setItemRows([]);
      setRemovedRows([]);
      return;
    }

    setSelectedSupplierId(supplierId);
    setErrors({});
    const quickSup = eligibleSuppliers.find((s) => s.supplierId === supplierId) || null;
    setSelectedSupplierDetails(quickSup);

    try {
      const res = await actionResponse(getSupplierForOrder(supplierId));
      if (res.data?.success && res.data.data) {
        setSelectedSupplierDetails(res.data.data);
      }
    } catch {
      // Fallback already assigned from eligibleSuppliers
    }
    if (selectedPR) {
      fetchItemsForSupplier(supplierId, selectedPR);
    }
    fetchNextPoNumber();
  };

  const updateRow = (idx: number, value: string) => {
    if (value !== "" && !/^\d*\.?\d{0,3}$/.test(value)) return;
    const targetRow = itemRows[idx];
    setItemRows((prev) => prev.map((row, i) => (i === idx ? { ...row, orderQty: value } : row)));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.items;
      const qty = parseFloat(value);
      if (value === "" || isNaN(qty) || qty < 0) {
        copy[`qty_${idx}`] = "Required";
      } else if (!isEdit && targetRow && qty > targetRow.remaining) {
        copy[`qty_${idx}`] = `Cannot exceed remaining (${targetRow.remaining})`;
      } else {
        delete copy[`qty_${idx}`];
      }
      return copy;
    });
  };

  const handleRemoveRow = (idx: number) => {
    setItemRows((prev) => {
      const target = prev[idx];
      if (target) {
        setRemovedRows((r) => (r.some((x) => x.itemId === target.itemId) ? r : [...r, target]));
      }
      return prev.filter((_, i) => i !== idx);
    });
    setErrors({});
  };

  const handleRestoreRemovedRows = () => {
    if (removedRows.length === 0) return;
    setItemRows((prev) => {
      const existingIds = new Set(prev.map((r) => r.itemId));
      const toAdd = removedRows.filter((r) => !existingIds.has(r.itemId));
      return [...prev, ...toAdd];
    });
    setRemovedRows([]);
    setErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !selectedPR) {
      errs.pr = "Please select an approved Purchase Requisition.";
    }
    if (!selectedSupplierId) {
      errs.supplier = "Please select a Supplier.";
    }
    const hasAnyQty = itemRows.some((row) => (parseFloat(row.orderQty) || 0) > 0);
    if (!hasAnyQty) {
      errs.items = "Please enter an order quantity greater than 0 for at least one item.";
    }
    itemRows.forEach((row, idx) => {
      const qty = parseFloat(row.orderQty);
      if (row.orderQty === "" || isNaN(qty) || qty < 0) {
        errs[`qty_${idx}`] = "Required";
      } else if (!isEdit && qty > row.remaining) {
        errs[`qty_${idx}`] = `Cannot exceed remaining (${row.remaining})`;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isFormValid = useMemo(() => {
    if (!isEdit && !selectedPR) return false;
    if (!selectedSupplierId) return false;
    const activeRows = itemRows.filter((r) => (parseFloat(r.orderQty) || 0) > 0);
    if (activeRows.length === 0) return false;
    return activeRows.every((r) => {
      const qty = parseFloat(r.orderQty) || 0;
      if (!isEdit && qty > r.remaining) return false;
      return true;
    });
  }, [selectedPR, selectedSupplierId, itemRows, isEdit]);

  const selectedSupplier: SupplierOption | null =
    selectedSupplierDetails ||
    eligibleSuppliers.find((s) => s.supplierId === selectedSupplierId) ||
    (initialPo
      ? {
          supplierId: initialPo.supplierId,
          supplierName: initialPo.supplierName,
          email: initialPo.supplierEmail,
          contactPerson: initialPo.supplierContactPerson,
          phone: initialPo.supplierPhone,
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
        initialStatus: "Pending Approval",
        emailConfirmed: false,
        items: activeRows.map((row) => ({
          itemId: row.itemId,
          poItemQuantity: parseFloat(row.orderQty),
          purchaseUomId: row.purchaseUomId || undefined,
        })),
      };

      const res =
        isEdit && initialPo?.poId
          ? await procurement.updateOrder(initialPo.poId, payload)
          : await procurement.createOrder(payload);

      if (res.data?.success) {
        const created: PurchaseOrderPO = res.data.data;
        const poNum = created?.poNumber || nextPoNumber || "Purchase Order";
        const prRef = selectedPR?.prNumber || initialPo?.prNumber || "N/A";

        // Build clean, formal email body (direct questions, no brackets/underscores/dots)
        const orderDetailsLines = activeRows
          .map((r, i) => `${i + 1}. ${r.itemName} - ${r.orderQty} ${r.uomName}`)
          .join("\n");

        const contactName = selectedSupplier?.contactPerson
          ? `Mr./Ms. ${selectedSupplier.contactPerson}`
          : selectedSupplier?.supplierName || "Valued Supplier Partner";
        const supplierCompany = selectedSupplier?.supplierName || "your company";

        const notesSection = notes.trim()
          ? `\nAdditional Notes / Instructions:\n${notes.trim()}\n`
          : "";

        const supplierEmail = selectedSupplier?.email?.trim() || "";
        const emailSubject = `Purchase Order ${poNum} - Bren Raphael's Ube Jam & Halaya`;
        const emailBody =
          `Dear ${contactName},\n\n` +
          `Good day!\n\n` +
          `On behalf of Bren Raphael's Ube Jam & Halaya, we would like to formally place Purchase Order No. ${poNum} (Ref. ${prRef}) with ${supplierCompany}. Please find the official Purchase Order document (${poNum}.pdf) attached to this email for your reference.\n\n` +
          `Requested Order Particulars:\n` +
          `${orderDetailsLines}\n` +
          `${notesSection}\n` +
          `To confirm this order, kindly reply to this email with the following details:\n` +
          `1. The exact quantity you can accommodate for each requested item.\n` +
          `2. The total price for each item and the overall total order amount.\n` +
          `3. Your committed delivery date.\n` +
          `4. The full name, position, and contact number of the authorized representative confirming this order.\n\n` +
          `Should you have any questions, please feel free to reach out to us.\n\n` +
          `Thank you very much, and we look forward to your confirmation.\n\n` +
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
        setErrors((p) => ({
          ...p,
          general: res.data?.message || "Failed to create Purchase Order.",
        }));
      }
    } catch (e: unknown) {
      if (gmailTab && !gmailTab.closed) gmailTab.close();
      setErrors((p) => ({
        ...p,
        general: e instanceof Error ? e.message : "Failed to create Purchase Order.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsSentInGmail = async () => {
    if (!createdOrder) return;
    setSubmitting(true);
    try {
      const res = await procurement.setOrderStatus(createdOrder.poId, {
        status: "Pending Approval",
        emailConfirmed: true,
      });
      const updatedOrder: PurchaseOrderPO = res.data?.data || {
        ...createdOrder,
        status: "Pending Approval",
        emailConfirmed: true,
      };
      setIsConfirmedSent(true);
      onSuccess(updatedOrder);
      setCreatedOrder(null);
      onClose();
    } catch (e: unknown) {
      setErrors((p) => ({
        ...p,
        general: e instanceof Error ? e.message : "Failed to mark Purchase Order as sent.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrCloseWhileWaiting = async () => {
    const pendingOrder = createdOrder && !isConfirmedSent ? createdOrder : null;
    setIsReviewing(false);
    setCreatedOrder(null);
    setIsConfirmedSent(false);
    if (pendingOrder) {
      // Keep the PO in Pending Approval (no Draft rollback); user can confirm email send later from PO Details
      onSuccess({ ...pendingOrder, status: "Pending Approval", emailConfirmed: false });
    }
    onClose();
  };

  const handleCloseAction = () => {
    if (createdOrder && !isConfirmedSent) {
      setConfirmDiscardWaitingOpen(true);
      return;
    }
    if (variant === "page") {
      setConfirmLeaveOpen(true);
      return;
    }
    setIsReviewing(false);
    setCreatedOrder(null);
    setIsConfirmedSent(false);
    onClose();
  };

  const executeLeaveForm = () => {
    setConfirmLeaveOpen(false);
    setIsReviewing(false);
    setCreatedOrder(null);
    setIsConfirmedSent(false);
    onClose();
  };

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "w-full min-w-0 space-y-5";

  return (
    <div className={containerClasses}>
      {/* Page Header & Back Breadcrumb (Page Mode) */}
      {variant === "page" && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={handleCloseAction}
            className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Purchase orders</span>
          </button>

          <h1 className="type-page-title text-ink">
            {createdOrder
              ? "Review & send in Gmail"
              : isReviewing
              ? "Review purchase order"
              : isEdit
              ? `Edit purchase order — ${initialPo?.poNumber}`
              : "New purchase order"}
          </h1>
          <p className="type-body text-ink-muted">
            {createdOrder
              ? "Attach the downloaded Purchase Order PDF in Gmail and confirm once sent."
              : isReviewing
              ? "Verify the supplier and order quantities before preparing the Gmail draft and PDF."
              : "Order ingredients, packaging or tools from a supplier."}
          </p>
        </div>
      )}

      {/* General Error Banner */}
      {errors.general && (
        <div
          role="alert"
          className="rounded-inner border border-notice-danger-border bg-notice-danger-bg p-3 type-caption text-notice-danger-text flex items-center justify-between"
        >
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
            className="font-semibold underline ml-2 shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {createdOrder ? (
        /* Post-Submit Waiting for Gmail Send View */
        <div className="rounded-card border border-border bg-surface p-5 space-y-5 max-w-3xl">
          <div className="p-3.5 rounded-inner bg-notice-warning-bg border border-notice-warning-border type-body-secondary text-notice-warning-text flex items-start gap-2.5">
            <Mail className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span>
              <strong>{createdOrder.poNumber}</strong> is now in <strong>Pending Approval</strong>,
              and your PDF (<strong>{createdOrder.poNumber}.pdf</strong>) has been downloaded.
              Please confirm after sending the email in Gmail by clicking <strong>Done</strong>. If
              you close this screen before confirming, you will still be prompted to confirm sending
              the email before you can approve this order.
            </span>
          </div>

          {/* Summary Card (2x2) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-inner bg-page border border-divider">
            <div>
              <span className="text-ink-muted block type-caption mb-1">Purchase Order Number</span>
              <span className="type-body-strong text-ink tabular-nums">
                {createdOrder.poNumber}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Supplier</span>
              <span className="type-body-strong text-ink">
                {selectedSupplier?.supplierName || initialPo?.supplierName || "—"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Recipient Email</span>
              <span className="type-body-strong text-ink break-all">
                {selectedSupplier?.email || "No email registered"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Contact person</span>
              <span className="type-body-strong text-ink">
                {selectedSupplier?.contactPerson || selectedSupplier?.supplierName || "—"}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="table-card">
            <table className="w-full type-table-cell">
              <thead className="table-head-row border-b border-divider">
                <tr>
                  <th className="table-th text-left">Item</th>
                  <th className="table-th text-left">Unit</th>
                  <th className="table-th text-right">Order Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {itemRows
                  .filter((row) => (parseFloat(row.orderQty) || 0) > 0)
                  .map((row, idx) => (
                    <tr key={idx} className="hover:bg-page table-row">
                      <td className="table-td font-medium text-ink">{row.itemName}</td>
                      <td className="table-td text-ink-muted">{row.uomName}</td>
                      <td className="table-td text-right font-semibold text-ink tabular-nums">
                        {row.orderQty}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Next Steps in Gmail */}
          <div className="p-4 rounded-inner bg-page border border-divider type-body-secondary space-y-2">
            <span className="type-subsection text-ink block">Next steps in Gmail</span>
            <ol className="list-decimal list-inside space-y-1 text-ink-secondary">
              <li>
                Attach the downloaded{" "}
                <strong className="text-ink">{createdOrder.poNumber}.pdf</strong> in the opened
                Gmail tab.
              </li>
              <li>Review the formal email message and supplier questionnaire.</li>
              <li>
                Click <strong className="text-ink">Send</strong> in Gmail, then click{" "}
                <strong className="text-ink">Done</strong> below.
              </li>
            </ol>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-divider">
            {variant === "modal" ? (
              <ModalCloseButton
                type="button"
                variant="outline"
                disabled={submitting}
                fallbackOnClose={handleCancelOrCloseWhileWaiting}
                className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                Close
              </ModalCloseButton>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setConfirmDiscardWaitingOpen(true)}
                className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                Close
              </Button>
            )}
            <a
              href={gmailComposeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-primary" />
              Edit Gmail
            </a>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmDoneOpen(true)}
              className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Confirming..." : "Done"}
            </Button>
          </div>
        </div>
      ) : isReviewing ? (
        /* Review Purchase Order Step */
        <div className="rounded-card border border-border bg-surface p-5 space-y-5 max-w-3xl">
          <div className="flex items-start gap-2.5 type-body-secondary text-ink-secondary">
            <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Please review the items below. Confirming will open Gmail in a new tab with the
              formal email &amp; questionnaire prepared, and download your official Purchase Order
              PDF for you to attach.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-inner bg-page border border-divider">
            <div>
              <span className="text-ink-muted block type-caption mb-1">Purchase Order Number</span>
              <span className="type-body-strong text-ink tabular-nums">
                {nextPoNumber || "Auto-assigned"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Purchase Requisition</span>
              <span className="type-body-strong text-ink tabular-nums">
                {selectedPR?.prNumber || initialPo?.prNumber || "—"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Supplier</span>
              <span className="type-body-strong text-ink">
                {selectedSupplier?.supplierName || initialPo?.supplierName || "—"}
              </span>
            </div>
          </div>

          <div className="table-card">
            <table className="w-full type-table-cell">
              <thead className="table-head-row border-b border-divider">
                <tr>
                  <th className="table-th text-left">Item</th>
                  <th className="table-th text-left">Unit</th>
                  <th className="table-th text-right">Order Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {itemRows
                  .filter((row) => (parseFloat(row.orderQty) || 0) > 0)
                  .map((row, idx) => (
                    <tr key={idx} className="hover:bg-page table-row">
                      <td className="table-td font-medium text-ink">{row.itemName}</td>
                      <td className="table-td text-ink-muted">{row.uomName}</td>
                      <td className="table-td text-right font-semibold text-ink tabular-nums">
                        {row.orderQty}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {notes.trim() && (
            <div className="p-3.5 rounded-inner bg-page border border-divider space-y-1">
              <span className="type-caption text-ink-muted block">Notes</span>
              <p className="type-body-secondary text-ink whitespace-pre-wrap">{notes.trim()}</p>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-divider">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReviewing(false)}
              disabled={submitting}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Edit
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmSendOpen(true)}
              className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Preparing Gmail Draft..." : "Confirm & Send to Supplier"}
            </Button>
          </div>
        </div>
      ) : (
        /* Main Single-Page Figma Layout (Form · New purchase order) */
        <>
          <div
            className={
              variant === "page"
                ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start"
                : "space-y-4"
            }
          >
            {/* Main Column: Purchase order details + Items */}
            <div className="min-w-0 space-y-5">
              {/* Card 1: Purchase order details */}
              <div className="rounded-card border border-border bg-surface p-5 space-y-4">
                <h2 className="type-subsection text-ink">Purchase order details</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Purchase Order Number (read-only, no dropdown chevron) */}
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong">
                      Purchase Order Number
                    </label>
                    <div className="flex items-center h-9 px-3 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums select-all">
                      {nextPoNumber || "Assigned on save"}
                    </div>
                  </div>

                  {/* Select Purchase Requisition * (PR number only, no abbreviations) */}
                  <div>
                    <label
                      htmlFor="po-select-pr"
                      className={`mb-1.5 block type-label-field ${
                        errors.pr ? "text-destructive" : "text-ink-strong"
                      }`}
                    >
                      Select Purchase Requisition <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="po-select-pr"
                        disabled={isEdit || loadingPRs}
                        value={selectedPR?.prId || ""}
                        onChange={(e) => handleSelectPR(e.target.value)}
                        className={`w-full h-9 appearance-none rounded-control border ${
                          errors.pr ? "border-destructive" : "border-input"
                        } bg-surface pl-3 pr-9 type-body-secondary ${
                          selectedPR ? "text-ink" : "text-ink-muted"
                        } transition-colors cursor-pointer focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none disabled:bg-page disabled:text-ink-muted disabled:cursor-not-allowed`}
                      >
                        <option value="">
                          {loadingPRs
                            ? "Loading requisitions..."
                            : approvedPRs.length === 0 && !isEdit
                            ? "No approved requisitions available"
                            : "Select purchase requisition"}
                        </option>
                        {isEdit && selectedPR && !approvedPRs.some((p) => p.prId === selectedPR.prId) && (
                          <option value={selectedPR.prId}>{selectedPR.prNumber}</option>
                        )}
                        {approvedPRs.map((pr) => (
                          <option key={pr.prId} value={pr.prId}>
                            {pr.prNumber}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                    </div>
                    {errors.pr && (
                      <p className="mt-1 type-caption text-destructive">{errors.pr}</p>
                    )}
                  </div>

                  {/* Supplier * (full width, dropdown with chevron-down icon) */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="po-select-supplier"
                      className={`mb-1.5 block type-label-field ${
                        errors.supplier ? "text-destructive" : "text-ink-strong"
                      }`}
                    >
                      Supplier <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="po-select-supplier"
                        disabled={isEdit || !selectedPR || loadingSuppliers}
                        value={selectedSupplierId || ""}
                        onChange={(e) => void handleSelectSupplier(e.target.value)}
                        className={`w-full h-9 appearance-none rounded-control border ${
                          errors.supplier ? "border-destructive" : "border-input"
                        } bg-surface pl-3 pr-9 type-body-secondary ${
                          selectedSupplierId ? "text-ink" : "text-ink-muted"
                        } transition-colors cursor-pointer focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none disabled:bg-page disabled:text-ink-muted disabled:cursor-not-allowed`}
                      >
                        <option value="">
                          {!selectedPR && !isEdit
                            ? "Select a purchase requisition first"
                            : loadingSuppliers
                            ? "Loading suppliers..."
                            : eligibleSuppliers.length === 0
                            ? "No active suppliers found for this requisition"
                            : "Select supplier"}
                        </option>
                        {eligibleSuppliers.map((sup) => (
                          <option key={sup.supplierId} value={sup.supplierId}>
                            {sup.supplierName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                    </div>
                    {errors.supplier && (
                      <p className="mt-1 type-caption text-destructive">{errors.supplier}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Items (Loaded from PR — no Add Item, only remove via trash icon) */}
              <div className="rounded-card border border-border bg-surface p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="type-subsection text-ink">Items</h2>
                    <p className="mt-0.5 type-caption text-ink-muted">
                      Items loaded from the selected Purchase Requisition. Remove items not included
                      in this order.
                    </p>
                  </div>
                  {removedRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreRemovedRows}
                      className="inline-flex items-center gap-1.5 type-label-button-sm text-primary hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore removed ({removedRows.length})</span>
                    </button>
                  )}
                </div>

                {errors.items && (
                  <div className="p-2.5 rounded-inner bg-notice-danger-bg border border-notice-danger-border type-caption text-notice-danger-text">
                    {errors.items}
                  </div>
                )}

                {!selectedPR && !isEdit ? (
                  <div className="rounded-inner border border-dashed border-border bg-page px-4 py-8 text-center type-body-secondary text-ink-muted">
                    Select a Purchase Requisition and Supplier above to load items.
                  </div>
                ) : !selectedSupplierId && !isEdit ? (
                  <div className="rounded-inner border border-dashed border-border bg-page px-4 py-8 text-center type-body-secondary text-ink-muted">
                    Select a Supplier to load items and remaining quantities for{" "}
                    <span className="font-medium text-ink">{selectedPR?.prNumber}</span>.
                  </div>
                ) : loadingItems ? (
                  <div className="py-8 text-center type-body-secondary text-ink-muted">
                    Loading items...
                  </div>
                ) : itemRows.length === 0 ? (
                  <div className="rounded-inner border border-dashed border-border bg-page px-4 py-8 text-center type-body-secondary text-ink-muted">
                    No items remaining in this order.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[560px] space-y-2.5">
                      {/* Column Headers: Items, Unit, Requested, Already Ordered, Order Quantity */}
                      <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.15fr)_32px] gap-3 items-center pb-1 border-b border-divider">
                        <div className="type-table-header text-ink-muted">Items</div>
                        <div className="type-table-header text-ink-muted">Unit</div>
                        <div className="type-table-header text-ink-muted text-right">Requested</div>
                        <div className="type-table-header text-ink-muted text-right">
                          Already Ordered
                        </div>
                        <div className="type-table-header text-ink-muted text-right">
                          Order Quantity
                        </div>
                        <div />
                      </div>

                      {/* Item Rows */}
                      {itemRows.map((row, idx) => {
                        const isFullyOrdered = !isEdit && row.remaining <= 0;
                        const parsedQty = parseFloat(row.orderQty);
                        const liveRowError =
                          errors[`qty_${idx}`] ||
                          (row.orderQty === "" || isNaN(parsedQty) || parsedQty < 0
                            ? "Required"
                            : !isEdit && parsedQty > row.remaining
                            ? `Cannot exceed remaining (${row.remaining})`
                            : "");
                        return (
                          <div key={row.itemId} className="space-y-1">
                            <div
                              className={`grid grid-cols-[minmax(0,2.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.15fr)_32px] gap-3 items-center ${
                                isFullyOrdered ? "opacity-55" : ""
                              }`}
                            >
                              {/* Items (Read-only display) */}
                              <div
                                title={row.itemName}
                                className="flex items-center h-9 px-3 rounded-control border border-input bg-page type-body-secondary font-medium text-ink truncate"
                              >
                                {row.itemName}
                              </div>

                              {/* Unit */}
                              <div className="type-body-secondary text-ink-secondary truncate">
                                {row.uomName}
                              </div>

                              {/* Requested */}
                              <div className="flex items-center justify-end h-9 px-3 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                                {Number(row.requestedQty).toLocaleString()}
                              </div>

                              {/* Already Ordered */}
                              <div className="flex items-center justify-end h-9 px-3 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                                {Number(row.alreadyOrdered).toLocaleString()}
                              </div>

                              {/* Order Quantity */}
                              <div className="min-w-0">
                                <Input
                                  aria-label={`Order quantity for ${row.itemName}`}
                                  aria-invalid={!!liveRowError}
                                  type="number"
                                  min={0}
                                  max={isEdit ? undefined : row.remaining}
                                  step="any"
                                  value={row.orderQty}
                                  disabled={isFullyOrdered}
                                  onChange={(e) => updateRow(idx, e.target.value)}
                                  className={`h-9 w-full text-right font-semibold type-body-secondary bg-surface rounded-control text-ink shadow-none tabular-nums ${
                                    liveRowError
                                      ? "!border-destructive focus-visible:!ring-destructive"
                                      : "border-input"
                                  }`}
                                />
                              </div>

                              {/* Remove Row */}
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="p-1.5 rounded-control text-ink-muted hover:text-destructive hover:bg-subtle transition-colors cursor-pointer"
                                  title={`Remove ${row.itemName}`}
                                  aria-label={`Remove ${row.itemName}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {liveRowError && (
                              <p
                                role="alert"
                                className="type-caption font-medium text-destructive text-right pr-10"
                              >
                                {liveRowError}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Side Column: Supplier information + Notes */}
            <div className="space-y-5">
              {/* Card 1: Supplier information */}
              <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
                <h2 className="type-subsection text-ink">Supplier information</h2>

                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Supplier</span>
                    <span className="font-medium text-ink text-right break-words">
                      {selectedSupplier?.supplierName || "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Contact person</span>
                    <span className="font-medium text-ink text-right break-words">
                      {selectedSupplier?.contactPerson || "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Email</span>
                    <span className="font-medium text-ink text-right break-all">
                      {selectedSupplier?.email || "—"}
                    </span>
                  </div>
                  {selectedSupplier?.address && (
                    <div className="flex items-start justify-between gap-3 type-body-secondary">
                      <span className="text-ink-muted shrink-0">Address</span>
                      <span className="font-medium text-ink text-right break-words">
                        {selectedSupplier.address}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
                  <span className="type-subsection text-ink">Phone</span>
                  <span className="type-body-strong text-ink tabular-nums">
                    {selectedSupplier?.phone || "—"}
                  </span>
                </div>
              </div>

              {/* Card 2: Notes */}
              <div className="rounded-card border border-border bg-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="type-subsection text-ink">Notes</h2>
                  <span className="type-caption text-ink-muted tabular-nums">
                    {notes.length}/300
                  </span>
                </div>
                <Textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Add delivery instructions or notes for the supplier..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-control border border-input bg-surface px-3 py-2.5 type-body-secondary text-ink shadow-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar (Cancel & Send order only — no Save as draft) */}
          <div
            className={
              variant === "page"
                ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-divider pt-4"
                : "flex flex-wrap justify-end gap-2.5 pt-4 border-t border-divider mt-4"
            }
          >
            {variant === "page" && (
              <p className="type-caption text-ink-muted">
                Sending prepares the official Purchase Order PDF and opens Gmail. Stock only goes up
                when you receive the items.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2.5 ml-auto">
              {variant === "modal" ? (
                <ModalCloseButton
                  type="button"
                  variant="outline"
                  fallbackOnClose={handleCloseAction}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
                >
                  Cancel
                </ModalCloseButton>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseAction}
                  disabled={submitting}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                disabled={submitting || !isFormValid}
                onClick={() => {
                  if (validate()) {
                    setIsReviewing(true);
                  }
                }}
                className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send order
              </Button>
            </div>
          </div>
        </>
      )}

      <ActionConfirmModal
        open={confirmSendOpen}
        title="Confirm & Send Purchase Order"
        subtitle={`Purchase Order Number: ${nextPoNumber || initialPo?.poNumber || "Auto-assigned"} • Supplier: ${selectedSupplier?.supplierName || initialPo?.supplierName || "—"}`}
        description="Are you sure you want to generate this Purchase Order PDF and open Gmail to send the order to the supplier?"
        confirmLabel="Confirm & Send"
        submitting={submitting}
        onCancel={() => setConfirmSendOpen(false)}
        onConfirm={() => {
          setConfirmSendOpen(false);
          void handleConfirmSendToSupplier();
        }}
      />

      <ActionConfirmModal
        open={confirmDoneOpen}
        title="Confirm Purchase Order Sent"
        subtitle={`Purchase Order Number: ${createdOrder?.poNumber || "—"}`}
        description={`Have you sent the email with ${createdOrder?.poNumber || "the Purchase Order"}.pdf attached in Gmail? Confirming will unlock Approve Order once the supplier replies.`}
        confirmLabel="Confirm Sent"
        submitting={submitting}
        onCancel={() => setConfirmDoneOpen(false)}
        onConfirm={() => {
          setConfirmDoneOpen(false);
          void handleMarkAsSentInGmail();
        }}
      />

      <ActionConfirmModal
        open={confirmLeaveOpen}
        title="Discard Unsaved Changes?"
        subtitle={
          nextPoNumber
            ? `Purchase Order Number: ${nextPoNumber}`
            : initialPo?.poNumber
            ? `Purchase Order Number: ${initialPo.poNumber}`
            : undefined
        }
        description="Are you sure you want to leave this page? Any unsaved selections or quantities for this purchase order will be lost."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        onCancel={() => setConfirmLeaveOpen(false)}
        onConfirm={executeLeaveForm}
      />

      <ActionConfirmModal
        open={confirmDiscardWaitingOpen}
        title="Leave Without Confirming Email?"
        subtitle={createdOrder?.poNumber ? `Purchase Order Number: ${createdOrder.poNumber}` : undefined}
        description={`${createdOrder?.poNumber || "This Purchase Order"} will remain in Pending Approval, but you will not be able to approve the order until you confirm that the email has been sent to the supplier.`}
        confirmLabel="Leave for Now"
        cancelLabel="Stay"
        submitting={submitting}
        onCancel={() => setConfirmDiscardWaitingOpen(false)}
        onConfirm={() => {
          setConfirmDiscardWaitingOpen(false);
          void handleCancelOrCloseWhileWaiting();
        }}
      />
    </div>
  );
}

/**
 * Full-page Purchase Order creation / editing form matching Figma "Form · New purchase order".
 */
export function CreatePOForm(props: CreatePOFormProps) {
  return <POFormBody {...props} active={true} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for tests or modal triggers.
 */
export function CreatePOModal({
  open,
  initialPrId,
  initialPo,
  isEdit = false,
  onClose,
  onSuccess,
  onDraftDiscarded,
}: CreatePOModalProps) {
  return (
    <ModalWrapper
      open={open}
      title={isEdit ? `Edit Purchase Order — ${initialPo?.poNumber}` : "New purchase order"}
      onClose={onClose}
      size="max-w-[760px]"
    >
      <POFormBody
        active={open}
        initialPrId={initialPrId}
        initialPo={initialPo}
        isEdit={isEdit}
        onClose={onClose}
        onSuccess={onSuccess}
        onDraftDiscarded={onDraftDiscarded}
        variant="modal"
      />
    </ModalWrapper>
  );
}
