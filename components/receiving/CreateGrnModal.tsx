"use client";

import { receivingDeliveries } from "@/lib/receiving/screen-data";
import { ReceivingSkeleton } from "./ReceivingSkeleton";
import { receiving } from "@/lib/receiving/client";
import {
  getDeliveryForReceiving,
  getOrderForReceiving,
  listDeliveriesForReceiving,
} from "@/app/actions/receiving/procurement-reads";
import { listItemChoices } from "@/app/actions/receiving/lookups";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Download,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import NestedDialog from "./NestedDialog";
import { ArrivedDelivery, GRN, QAInspection } from "./types";
import { downloadGrnReportPdf } from "./downloadGrnReportPdf";
import { getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";

export interface CreateGrnFormProps {
  initialDeliveryId?: number;
  initialDeliveries?: ArrivedDelivery[];
  initialReceipts?: GRN[];
  onClose: () => void;
  onSuccess: (grn: GRN) => void;
  /** When true, omits outer page-container padding (e.g. embedded inside ReceivingFullPageProvider). */
  embedded?: boolean;
}

export interface CreateGrnModalProps {
  open: boolean;
  initialDeliveryId?: number;
  initialDeliveries?: ArrivedDelivery[];
  initialReceipts?: GRN[];
  onClose: () => void;
  onSuccess: (grn: GRN) => void;
}

interface ItemBatch {
  id: string;
  expiryDate: string;
  deliveredQuantity: number | "";
}

interface ItemRow {
  poItemId: number;
  deliveryItemId: number;
  itemId: number;
  itemName: string;
  categoryName: string;
  hasExpiry: boolean;
  ordered: number;
  previous: number;
  declared: number;
  uom: string;
  batches: ItemBatch[];
}

interface BatchQaState {
  acceptedQuantity: number | "";
  rejectedQuantity: number | "";
  acceptedReason: string;
  defectReason: string;
  concessionQuantity: number;
  notes: string;
  checks: Record<string, boolean>;
  customizedSplit: boolean;
}

interface UnifiedQaRow {
  batchId: string;
  itemId: number;
  itemName: string;
  categoryName: string;
  uom: string;
  hasExpiry: boolean;
  batchNumber: number;
  totalBatches: number;
  expiryDate?: string;
  deliveredQuantity: number;
  acceptedQuantity: number | "";
  acceptedReason: string;
  rejectedQuantity: number | "";
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

const acceptanceReasons = [
  "Meets All Sensory & Packaging Standards",
  "Approved with Minor Packaging Tolerance",
  "Within Critical Chemical & Physical Limits",
];

const defectReasons = [
  "Expired / Insufficient Shelf Life",
  "Damaged Packaging / Torn Seal",
  "Contamination / Foreign Matter",
  "Temperature Abuse / Thawed",
  "Incorrect Product / Model",
  "Quality / Visual Defect",
  "Documentation Missing / Incomplete",
  "Quantity Shortage / Missing Units",
  "Other Quality Non-Conformance",
];

const receivingChecks = [
  ["physicalQuantityVerified", "Physical quantity verified"],
  ["itemsMatchPurchaseOrder", "Items match delivery manifest"],
  ["supplierDocumentsChecked", "Supplier documents checked"],
  ["packagingConditionChecked", "Packaging / condition checked"],
] as const;

function createEmptyChecks(): Record<string, boolean> {
  return Object.fromEntries(
    [...rawMaterialChecks, ...nonExpiryChecks].map((c) => [c.id, false])
  );
}

function createDefaultBatchQa(deliveredQty = 0): BatchQaState {
  return {
    acceptedQuantity: deliveredQty,
    rejectedQuantity: 0,
    acceptedReason: deliveredQty > 0 ? acceptanceReasons[0] : "",
    defectReason: "",
    concessionQuantity: 0,
    notes: "",
    checks: createEmptyChecks(),
    customizedSplit: false,
  };
}

function formatDisplayDate(raw?: string | Date | null): string {
  if (!raw) return "—";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CreateGrnBodyProps {
  active: boolean;
  variant: "page" | "modal";
  embedded?: boolean;
  initialDeliveryId?: number;
  initialDeliveries?: ArrivedDelivery[];
  initialReceipts?: GRN[];
  onClose: () => void;
  onSuccess: (grn: GRN) => void;
}

function CreateGrnBody({
  active,
  variant,
  embedded = false,
  initialDeliveryId,
  initialDeliveries,
  initialReceipts,
  onClose,
  onSuccess,
}: CreateGrnBodyProps) {
  const [deliveries, setDeliveries] = useState<ArrivedDelivery[]>(initialDeliveries || []);
  const [selected, setSelected] = useState<ArrivedDelivery | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [qaByBatchId, setQaByBatchId] = useState<Record<string, BatchQaState>>({});
  const [expandedQaBatches, setExpandedQaBatches] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [previewGrnNo, setPreviewGrnNo] = useState<string>("GRN-Pending");
  const [notes, setNotes] = useState("");
  const categoryCacheRef = useRef<Record<number, { categoryName: string; hasExpiry: boolean }> | null>(
    null
  );

  // Receiving Check checkboxes
  const [verified, setVerified] = useState<Record<string, boolean>>({
    physicalQuantityVerified: false,
    itemsMatchPurchaseOrder: false,
    supplierDocumentsChecked: false,
    packagingConditionChecked: false,
  });

  // Modals (preserved)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmFinishGrnOpen, setConfirmFinishGrnOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Active GRN / QA Inspection references (for retry resilience if sign-off partially completed)
  const [activeGrn, setActiveGrn] = useState<GRN | null>(null);
  const [qaInspection, setQaInspection] = useState<QAInspection | null>(null);

  const todayDisplay = useMemo(() => formatDisplayDate(new Date()), []);

  useEffect(() => {
    if (!active) return;
    setError(null);
    setFieldErrors({});
    setItems([]);
    setQaByBatchId({});
    setExpandedQaBatches({});
    setSelected(null);
    setNotes("");
    setActiveGrn(null);
    setQaInspection(null);
    setShowRejectModal(false);
    setRejectionReason("");
    setConfirmFinishGrnOpen(false);
    setConfirmDiscardOpen(false);
    setVerified({
      physicalQuantityVerified: false,
      itemsMatchPurchaseOrder: false,
      supplierDocumentsChecked: false,
      packagingConditionChecked: false,
    });

    const computeNextGrn = (grns: GRN[]) => {
      const year = new Date().getFullYear();
      let maxSeq = 0;
      grns.forEach((g) => {
        if (g.grnNumber) {
          const m = g.grnNumber.match(/GRN-\d{4}-(\d+)/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxSeq) maxSeq = num;
          }
        }
      });
      const nextSeq = Math.max(maxSeq, grns.length) + 1;
      setPreviewGrnNo(`GRN-${year}-${String(nextSeq).padStart(4, "0")}`);
    };

    if (initialReceipts && initialReceipts.length > 0) {
      computeNextGrn(initialReceipts);
    } else {
      receiving
        .listReceipts()
        .then(({ data }) => {
          const allGrns: GRN[] = Array.isArray(data?.data) ? data.data : [];
          computeNextGrn(allGrns);
        })
        .catch(() => {
          const year = new Date().getFullYear();
          setPreviewGrnNo(`GRN-${year}-0001`);
        });
    }

    if (initialDeliveries && initialDeliveries.length > 0) {
      setDeliveries(initialDeliveries);
      if (initialDeliveryId) {
        const target = initialDeliveries.find((d) => d.deliveryId === initialDeliveryId);
        if (target) loadSource(target);
      }
    } else {
      receivingDeliveries(listDeliveriesForReceiving)
        .then((arrived) => {
          setDeliveries(arrived);
          if (initialDeliveryId) {
            const target = arrived.find((d: ArrivedDelivery) => d.deliveryId === initialDeliveryId);
            if (target) loadSource(target);
          }
        })
        .catch(() =>
          setError("Unable to load arrived deliveries. Please refresh and try again.")
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, initialDeliveryId]);

  const getCategoryMap = async (): Promise<
    Record<number, { categoryName: string; hasExpiry: boolean }>
  > => {
    if (categoryCacheRef.current) return categoryCacheRef.current;
    try {
      const itemsCatalogRes = await actionResponse(listItemChoices());
      const catalogItems = Array.isArray(itemsCatalogRes.data?.data?.items)
        ? itemsCatalogRes.data.data.items
        : Array.isArray(itemsCatalogRes.data?.data)
        ? itemsCatalogRes.data.data
        : [];
      const map: Record<number, { categoryName: string; hasExpiry: boolean }> = {};
      catalogItems.forEach((catItem: any) => {
        if (catItem.itemId) {
          map[catItem.itemId] = {
            categoryName: catItem.categoryName || "",
            hasExpiry: catItem.categoryHasExpiry !== false,
          };
        }
      });
      categoryCacheRef.current = map;
      return map;
    } catch {
      return {};
    }
  };

  const loadSource = async (delivery: ArrivedDelivery) => {
    setSelected(delivery);
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setItems([]);
    setQaByBatchId({});
    setExpandedQaBatches({});
    setActiveGrn(null);
    setQaInspection(null);
    try {
      const [deliveryResult, poResult, categoryMap] = await Promise.all([
        actionResponse(getDeliveryForReceiving(delivery.deliveryId)),
        actionResponse(getOrderForReceiving(delivery.poId)),
        getCategoryMap(),
      ]);

      const poItems = poResult.data?.data?.items || [];
      const initialQaMap: Record<string, BatchQaState> = {};
      const initialExpandMap: Record<string, boolean> = {};

      const rows: ItemRow[] = (deliveryResult.data?.data?.items || []).map(
        (line: any, idx: number) => {
          const po = poItems.find((p: any) => p.poItemId === line.poItemId) || line;
          const declared = Number(line.declaredQuantity);
          const catInfo = categoryMap[line.itemId];
          const resolvedCategory =
            catInfo?.categoryName || po.categoryName || line.categoryName || "Raw Materials";
          const resolvedHasExpiry =
            catInfo?.hasExpiry ?? po.categoryHasExpiry ?? line.categoryHasExpiry ?? true;

          const batchId = `batch-${delivery.deliveryId}-${line.deliveryItemId}-${idx}-${Date.now()}`;
          initialQaMap[batchId] = createDefaultBatchQa(0);
          initialExpandMap[batchId] = true;

          return {
            poItemId: line.poItemId,
            deliveryItemId: line.deliveryItemId,
            itemId: line.itemId,
            itemName: line.itemName || `Item #${line.itemId}`,
            categoryName: resolvedCategory,
            hasExpiry: resolvedHasExpiry,
            ordered: Number(po.quantity ?? line.poOrderedQuantity ?? 0),
            previous: Number(po.receivedQuantity ?? line.poTotalReceivedQuantity ?? 0),
            declared,
            uom: line.purchaseUomName || line.uomName || "Unit",
            batches: [
              {
                id: batchId,
                expiryDate: "",
                deliveredQuantity: "",
              },
            ],
          };
        }
      );

      setItems(rows);
      setQaByBatchId(initialQaMap);
      setExpandedQaBatches(initialExpandMap);
    } catch {
      setError("Unable to load delivery source lines.");
    } finally {
      setLoading(false);
    }
  };

  // Batch count & expiry updates — automatically synced to unified QA cards
  const updateBatchQuantity = (itemIndex: number, batchIndex: number, value: string) => {
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[`qty_${itemIndex}_${batchIndex}`];
      return copy;
    });

    const targetBatchId = items[itemIndex]?.batches[batchIndex]?.id;
    const qty: number | "" = value.trim() === "" ? "" : Math.max(0, Number(value));
    const numericQty = typeof qty === "number" && !isNaN(qty) ? qty : 0;

    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const newBatches: ItemBatch[] = item.batches.map((b, bi) => {
          if (bi !== batchIndex) return b;
          return { ...b, deliveredQuantity: qty };
        });
        return { ...item, batches: newBatches };
      })
    );

    if (targetBatchId) {
      setQaByBatchId((prev) => {
        const existing = prev[targetBatchId] ?? createDefaultBatchQa(numericQty);
        if (numericQty <= 0) {
          return {
            ...prev,
            [targetBatchId]: {
              ...existing,
              acceptedQuantity: 0,
              rejectedQuantity: 0,
              defectReason: "",
            },
          };
        }

        if (!existing.customizedSplit) {
          return {
            ...prev,
            [targetBatchId]: {
              ...existing,
              acceptedQuantity: numericQty,
              rejectedQuantity: 0,
              acceptedReason: existing.acceptedReason || acceptanceReasons[0],
              defectReason: "",
            },
          };
        }

        const prevRej = Math.min(Number(existing.rejectedQuantity || 0), numericQty);
        const nextAcc = numericQty - prevRej;
        return {
          ...prev,
          [targetBatchId]: {
            ...existing,
            acceptedQuantity: nextAcc,
            rejectedQuantity: prevRej,
            acceptedReason: nextAcc > 0 ? existing.acceptedReason || acceptanceReasons[0] : "",
            defectReason: prevRej === 0 ? "" : existing.defectReason,
          },
        };
      });
    }
  };

  const updateBatchExpiry = (itemIndex: number, batchIndex: number, value: string) => {
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[`expiry_${itemIndex}_${batchIndex}`];
      return copy;
    });
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const newBatches = item.batches.map((b, bi) => {
          if (bi !== batchIndex) return b;
          return { ...b, expiryDate: value };
        });
        return { ...item, batches: newBatches };
      })
    );
  };

  const addBatch = (itemIndex: number) => {
    const newId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        return {
          ...item,
          batches: [
            ...item.batches,
            {
              id: newId,
              expiryDate: "",
              deliveredQuantity: "",
            },
          ],
        };
      })
    );
    setQaByBatchId((prev) => ({ ...prev, [newId]: createDefaultBatchQa(0) }));
    setExpandedQaBatches((prev) => ({ ...prev, [newId]: true }));
  };

  const removeBatch = (itemIndex: number, batchIndex: number) => {
    const removedId = items[itemIndex]?.batches[batchIndex]?.id;
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        if (item.batches.length <= 1) return item;
        return {
          ...item,
          batches: item.batches.filter((_, bi) => bi !== batchIndex),
        };
      })
    );
    if (removedId) {
      setQaByBatchId((prev) => {
        const copy = { ...prev };
        delete copy[removedId];
        return copy;
      });
      setExpandedQaBatches((prev) => {
        const copy = { ...prev };
        delete copy[removedId];
        return copy;
      });
    }
  };

  const getItemTotalActual = (item: ItemRow): number =>
    item.batches.reduce((sum, b) => {
      const q = typeof b.deliveredQuantity === "number" ? b.deliveredQuantity : 0;
      return sum + q;
    }, 0);

  const hasAnyQty = (item: ItemRow): boolean =>
    item.batches.some(
      (b) =>
        b.deliveredQuantity !== "" &&
        typeof b.deliveredQuantity === "number" &&
        b.deliveredQuantity > 0
    );

  const isItemExpiryRequired = (item: ItemRow): boolean => item.hasExpiry;

  const isBatchValid = (b: ItemBatch, reqExpiry: boolean): boolean => {
    const hasQty =
      b.deliveredQuantity !== "" &&
      typeof b.deliveredQuantity === "number" &&
      !isNaN(b.deliveredQuantity) &&
      b.deliveredQuantity > 0;
    const hasExpiry = reqExpiry ? Boolean(b.expiryDate && b.expiryDate.trim()) : true;
    return hasQty && hasExpiry;
  };

  const isItemCounted = (item: ItemRow): boolean => {
    const reqExpiry = isItemExpiryRequired(item);
    return item.batches.length > 0 && item.batches.every((b) => isBatchValid(b, reqExpiry));
  };

  const isCountsComplete = Boolean(
    selected &&
      items.length > 0 &&
      items.every((item) => isItemCounted(item)) &&
      Object.keys(fieldErrors).length === 0
  );

  // Derived QA rows synced 1:1 with all batches across all items
  const qaRows: UnifiedQaRow[] = useMemo(() => {
    return items.flatMap((item) =>
      item.batches.map((batch, bIdx) => {
        const delivered =
          typeof batch.deliveredQuantity === "number" && !isNaN(batch.deliveredQuantity)
            ? batch.deliveredQuantity
            : 0;
        const qa = qaByBatchId[batch.id] ?? createDefaultBatchQa(delivered);
        return {
          batchId: batch.id,
          itemId: item.itemId,
          itemName: item.itemName,
          categoryName: item.categoryName,
          uom: item.uom,
          hasExpiry: item.hasExpiry,
          batchNumber: bIdx + 1,
          totalBatches: item.batches.length,
          expiryDate: batch.expiryDate || undefined,
          deliveredQuantity: delivered,
          acceptedQuantity: qa.acceptedQuantity,
          acceptedReason: qa.acceptedReason,
          rejectedQuantity: qa.rejectedQuantity,
          concessionQuantity: qa.concessionQuantity,
          defectReason: qa.defectReason,
          notes: qa.notes,
          checks: qa.checks,
        };
      })
    );
  }, [items, qaByBatchId]);

  const getQaChecks = (row: UnifiedQaRow) =>
    row.expiryDate || row.hasExpiry !== false ? rawMaterialChecks : nonExpiryChecks;

  const handleSetAccepted = (batchId: string, deliveredQty: number, valStr: string) => {
    setQaByBatchId((prev) => {
      const current = prev[batchId] ?? createDefaultBatchQa(deliveredQty);
      if (valStr === "") {
        return {
          ...prev,
          [batchId]: { ...current, acceptedQuantity: "", customizedSplit: true },
        };
      }
      const num = Math.max(0, Math.min(deliveredQty, Number(valStr)));
      const rej = deliveredQty - num;
      return {
        ...prev,
        [batchId]: {
          ...current,
          acceptedQuantity: num,
          acceptedReason: num > 0 ? current.acceptedReason || acceptanceReasons[0] : "",
          rejectedQuantity: rej,
          defectReason: rej === 0 ? "" : current.defectReason,
          customizedSplit: true,
        },
      };
    });
  };

  const handleSetRejected = (batchId: string, deliveredQty: number, valStr: string) => {
    setQaByBatchId((prev) => {
      const current = prev[batchId] ?? createDefaultBatchQa(deliveredQty);
      if (valStr === "") {
        return {
          ...prev,
          [batchId]: { ...current, rejectedQuantity: "", customizedSplit: true },
        };
      }
      const num = Math.max(0, Math.min(deliveredQty, Number(valStr)));
      const acc = deliveredQty - num;
      return {
        ...prev,
        [batchId]: {
          ...current,
          rejectedQuantity: num,
          acceptedQuantity: acc,
          acceptedReason: acc > 0 ? current.acceptedReason || acceptanceReasons[0] : "",
          defectReason: num === 0 ? "" : current.defectReason,
          customizedSplit: true,
        },
      };
    });
  };

  const updateQaField = (batchId: string, patch: Partial<BatchQaState>) => {
    setQaByBatchId((prev) => {
      const current = prev[batchId] ?? createDefaultBatchQa(0);
      return { ...prev, [batchId]: { ...current, ...patch } };
    });
  };

  const toggleQaCheck = (batchId: string, checkId: string) => {
    setQaByBatchId((prev) => {
      const current = prev[batchId] ?? createDefaultBatchQa(0);
      return {
        ...prev,
        [batchId]: {
          ...current,
          checks: { ...current.checks, [checkId]: !current.checks[checkId] },
        },
      };
    });
  };

  const toggleCheckAll = (row: UnifiedQaRow) => {
    const available = getQaChecks(row);
    const allChecked = available.every((c) => row.checks[c.id]);
    setQaByBatchId((prev) => {
      const current = prev[row.batchId] ?? createDefaultBatchQa(row.deliveredQuantity);
      const newChecks = { ...current.checks };
      available.forEach((c) => {
        newChecks[c.id] = !allChecked;
      });
      return { ...prev, [row.batchId]: { ...current, checks: newChecks } };
    });
  };

  const toggleExpandQaBatch = (batchId: string) => {
    setExpandedQaBatches((prev) => ({
      ...prev,
      [batchId]: !prev[batchId],
    }));
  };

  const countedQaRows = useMemo(
    () => qaRows.filter((r) => r.deliveredQuantity > 0),
    [qaRows]
  );

  const isQaAllAccepted =
    countedQaRows.length > 0 &&
    countedQaRows.length === qaRows.length &&
    countedQaRows.every((i) => Number(i.acceptedQuantity) === Number(i.deliveredQuantity));

  const isQaAllRejected =
    countedQaRows.length > 0 &&
    countedQaRows.length === qaRows.length &&
    countedQaRows.every((i) => Number(i.rejectedQuantity) === Number(i.deliveredQuantity));

  const qaVerificationChoice = useMemo(() => {
    if (countedQaRows.length === 0) return "";
    if (isQaAllAccepted) return "All Accepted";
    if (isQaAllRejected) return "All Rejected";
    return "Partial Accept - Acceptable Quality";
  }, [countedQaRows.length, isQaAllAccepted, isQaAllRejected]);

  const isQaDone = Boolean(
    qaRows.length > 0 &&
      qaRows.every((i) => {
        if (i.deliveredQuantity <= 0) return false;
        const hasAccepted =
          typeof i.acceptedQuantity === "number" && !isNaN(i.acceptedQuantity);
        const hasRejected =
          typeof i.rejectedQuantity === "number" && !isNaN(i.rejectedQuantity);
        if (!hasAccepted || !hasRejected) return false;
        if (Number(i.acceptedQuantity) + Number(i.rejectedQuantity) !== Number(i.deliveredQuantity))
          return false;
        if (Number(i.acceptedQuantity) > 0 && !i.acceptedReason.trim()) return false;
        if (Number(i.rejectedQuantity) > 0 && !i.defectReason.trim()) return false;
        return true;
      })
  );

  const isReadyToSignOff = isCountsComplete && isQaDone;

  // Summary metrics
  const totalCountedItems = useMemo(
    () => items.filter((item) => isItemCounted(item)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );
  const totalDeliveredUnits = useMemo(
    () => qaRows.reduce((s, r) => s + Number(r.deliveredQuantity || 0), 0),
    [qaRows]
  );
  const totalAcceptedUnits = useMemo(
    () => qaRows.reduce((s, r) => s + Number(r.acceptedQuantity || 0), 0),
    [qaRows]
  );
  const totalRejectedUnits = useMemo(
    () => qaRows.reduce((s, r) => s + Number(r.rejectedQuantity || 0), 0),
    [qaRows]
  );
  const verifiedChecksCount = useMemo(
    () => Object.values(verified).filter(Boolean).length,
    [verified]
  );

  const rawMaterials = items.filter(
    (i) =>
      !i.categoryName?.toLowerCase().includes("tool") &&
      !i.categoryName?.toLowerCase().includes("suppl")
  );
  const toolsAndSupplies = items.filter(
    (i) =>
      i.categoryName?.toLowerCase().includes("tool") ||
      i.categoryName?.toLowerCase().includes("suppl")
  );

  const hasUnsavedChanges = useMemo(() => {
    if (notes.trim()) return true;
    if (verifiedChecksCount > 0) return true;
    if (items.some((item) => item.batches.some((b) => b.deliveredQuantity !== "" || b.expiryDate))) {
      return true;
    }
    return false;
  }, [notes, verifiedChecksCount, items]);

  const handleRequestClose = () => {
    if (variant === "page" && hasUnsavedChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  // Validate all physical counts + QA inputs before opening final confirmation modal
  const validateBeforeSignOff = (): boolean => {
    if (!selected) {
      setFieldErrors({ delivery: "Please select an arrived delivery." });
      return false;
    }

    if (items.length === 0) {
      setError("No items found for this delivery.");
      return false;
    }

    const errs: Record<string, string> = {};
    items.forEach((item, itemIdx) => {
      const reqExpiry = isItemExpiryRequired(item);
      item.batches.forEach((b, batchIdx) => {
        const hasQty =
          b.deliveredQuantity !== "" &&
          typeof b.deliveredQuantity === "number" &&
          !isNaN(b.deliveredQuantity) &&
          b.deliveredQuantity > 0;
        if (!hasQty) {
          errs[`qty_${itemIdx}_${batchIdx}`] = "Quantity required (> 0)";
        }
        if (reqExpiry && (!b.expiryDate || !b.expiryDate.trim())) {
          errs[`expiry_${itemIdx}_${batchIdx}`] = "Expiry date required";
        }
      });
    });

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please complete all required physical counts and expiry dates before signing off.");
      return false;
    }

    if (!isQaDone) {
      setError(
        "Please complete the Quality Assurance review for every batch (Accepted + Rejected must equal Received, and required reasons must be selected)."
      );
      return false;
    }

    return true;
  };

  const handlePromptSignOff = () => {
    setError(null);
    if (!validateBeforeSignOff()) return;
    setConfirmFinishGrnOpen(true);
  };

  // Action: Reject Entire Shipment at gate (100% preserved backend logic)
  const handleRejectShipment = async () => {
    if (!selected) return;
    if (!rejectionReason.trim()) {
      setError("Please provide a reason for rejecting the shipment.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const requestItems =
        items.length > 0
          ? items.flatMap((i) =>
              i.batches.map((b) => ({
                poItemId: i.poItemId,
                deliveryItemId: i.deliveryItemId,
                itemId: i.itemId,
                deliveredQuantity: Number(b.deliveredQuantity) || 0,
                expiryDate:
                  i.hasExpiry && b.expiryDate
                    ? `${b.expiryDate.split("T")[0]}T12:00:00Z`
                    : undefined,
              }))
            )
          : (selected.items || []).map((line) => ({
              poItemId: line.poItemId,
              deliveryItemId: line.deliveryItemId,
              itemId: line.itemId,
              deliveredQuantity: 0,
            }));

      const existingGrnRes = await receiving.listReceipts(`deliveryId=${selected.deliveryId}`);
      const existingGrns: GRN[] = Array.isArray(existingGrnRes.data?.data)
        ? existingGrnRes.data.data
        : [];
      const activeOrDraft = existingGrns.find(
        (g) =>
          g.deliveryId === selected.deliveryId &&
          g.status !== "Cancelled" &&
          g.status !== "Rejected"
      );

      let targetGrnId: number;
      if (activeOrDraft) {
        targetGrnId = activeOrDraft.grnId;
      } else {
        const { data: createData } = await receiving.createReceipt({
          deliveryId: selected.deliveryId,
          notes: notes.trim() || undefined,
          ...verified,
          items: requestItems,
        });

        if (!createData?.success) {
          throw new Error(createData?.message || "Failed to initiate GRN for rejection.");
        }
        targetGrnId = createData.data.grnId;
      }

      const { data: rejectData } = await receiving.rejectReceipt(targetGrnId, {
        reason: rejectionReason.trim(),
        notes: notes.trim() || undefined,
      });

      if (!rejectData?.success) {
        throw new Error(rejectData?.message || "Failed to record shipment rejection.");
      }

      const fullGrnRes = await receiving.getReceipt(targetGrnId);
      setShowRejectModal(false);
      onSuccess(fullGrnRes.data?.data || rejectData.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to reject shipment.");
      setShowRejectModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Unified Action: Create/Update Draft -> Post GRN -> Fetch QA Inspection -> Complete QA Inspection
  // Uses 100% unchanged server actions in the exact same sequence as the legacy 2-step flow.
  const executeUnifiedSignOff = async () => {
    if (!validateBeforeSignOff() || !selected) {
      setConfirmFinishGrnOpen(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let resolvedGrn: GRN | null = activeGrn;

      const existingGrnRes = await receiving.listReceipts(`deliveryId=${selected.deliveryId}`);
      const existingGrns: GRN[] = Array.isArray(existingGrnRes.data?.data)
        ? existingGrnRes.data.data
        : [];

      const postedGrn = existingGrns.find(
        (g) =>
          g.deliveryId === selected.deliveryId &&
          g.status !== "Draft" &&
          g.status !== "Cancelled" &&
          g.status !== "Rejected"
      );

      const requestItems = items.flatMap((i) =>
        i.batches.map((b) => ({
          poItemId: i.poItemId,
          deliveryItemId: i.deliveryItemId,
          itemId: i.itemId,
          deliveredQuantity: Number(b.deliveredQuantity) || 0,
          expiryDate: i.hasExpiry && b.expiryDate ? b.expiryDate.split("T")[0] : undefined,
        }))
      );

      if (postedGrn) {
        resolvedGrn = postedGrn;
        setActiveGrn(postedGrn);
      } else {
        const draftGrn = existingGrns.find(
          (g) => g.deliveryId === selected.deliveryId && g.status === "Draft"
        );

        let createdGrn: GRN;
        if (draftGrn) {
          const { data: updateData } = await receiving.updateReceipt(draftGrn.grnId, {
            deliveryId: selected.deliveryId,
            notes: notes.trim() || undefined,
            items: requestItems,
          });
          createdGrn = updateData?.data || draftGrn;
        } else {
          const { data: createData } = await receiving.createReceipt({
            deliveryId: selected.deliveryId,
            notes: notes.trim() || undefined,
            ...verified,
            items: requestItems,
          });

          if (!createData?.success) {
            throw new Error(createData?.message || "Failed to create draft GRN.");
          }
          createdGrn = createData.data;
        }

        setActiveGrn(createdGrn);
        if (createdGrn.grnNumber) setPreviewGrnNo(createdGrn.grnNumber);

        // Post the draft GRN to generate the QA inspection
        const postResult = await receiving.postReceipt(createdGrn.grnId);
        if (!postResult.data?.success) {
          throw new Error(postResult.data?.message || "GRN saved as draft but failed to advance.");
        }

        const rawData = postResult.data?.data;
        resolvedGrn = {
          ...createdGrn,
          ...rawData,
          grnId: rawData?.grnId ?? rawData?.GrnId ?? createdGrn.grnId,
          grnNumber: rawData?.grnNumber ?? rawData?.GrnNumber ?? createdGrn.grnNumber,
          status: rawData?.status ?? rawData?.Status ?? "QaPending",
        };
        setActiveGrn(resolvedGrn);
      }

      const targetGrnId = resolvedGrn?.grnId ?? (resolvedGrn as any)?.GrnId;
      const targetGrnNumber = resolvedGrn?.grnNumber ?? (resolvedGrn as any)?.GrnNumber;
      if (targetGrnNumber) setPreviewGrnNo(targetGrnNumber);

      // Locate the QA inspection linked to this GRN
      let inspection: QAInspection | null = qaInspection;
      if (!inspection?.inspectionId || !inspection.items?.length) {
        const qaRes = await receiving.listInspections(`grnId=${targetGrnId}`);
        const inspectionList: QAInspection[] = Array.isArray(qaRes.data?.data)
          ? qaRes.data.data
          : Array.isArray(qaRes.data)
          ? qaRes.data
          : [];
        inspection = inspectionList[0] || null;
        setQaInspection(inspection);
      }

      if (!inspection?.inspectionId) {
        throw new Error("Unable to locate active quality inspection for this Goods Receipt Note.");
      }

      // Match server-created inspection items in exact per-item batch order to our unified QA rows
      const qaBucketsByItemId = new Map<number, UnifiedQaRow[]>();
      for (const row of qaRows) {
        const list = qaBucketsByItemId.get(row.itemId) || [];
        list.push(row);
        qaBucketsByItemId.set(row.itemId, list);
      }
      const itemOffsets: Record<number, number> = {};

      const payloadItems = (inspection.items || []).map((serverItem: any, idx: number) => {
        const offset = itemOffsets[serverItem.itemId] || 0;
        itemOffsets[serverItem.itemId] = offset + 1;
        const matchedRow =
          qaBucketsByItemId.get(serverItem.itemId)?.[offset] ||
          qaRows[idx] ||
          qaBucketsByItemId.get(serverItem.itemId)?.[0];

        const deliveredQty = Number(serverItem.deliveredQuantity ?? matchedRow?.deliveredQuantity ?? 0);
        const accQty = matchedRow ? Number(matchedRow.acceptedQuantity) : deliveredQty;
        const rejQty = matchedRow ? Number(matchedRow.rejectedQuantity) : 0;
        const concQty = matchedRow ? Number(matchedRow.concessionQuantity) : 0;

        return {
          inspectionItemId: serverItem.inspectionItemId,
          itemId: serverItem.itemId,
          lotId: serverItem.lotId || serverItem.lot?.lotId,
          deliveredQuantity: deliveredQty,
          acceptedQuantity: accQty,
          rejectedQuantity: rejQty,
          concessionQuantity: concQty,
          defectReason:
            rejQty > 0 && matchedRow?.defectReason.trim()
              ? matchedRow.defectReason.trim()
              : undefined,
          notes: matchedRow
            ? [
                accQty > 0 && matchedRow.acceptedReason
                  ? `[ACCEPTED: ${matchedRow.acceptedReason}]`
                  : "",
                rejQty > 0 && matchedRow.defectReason
                  ? `[REJECTED: ${matchedRow.defectReason}]`
                  : "",
                `[CHECKS: ${
                  getQaChecks(matchedRow)
                    .filter((check) => matchedRow.checks[check.id])
                    .map((check) => check.id)
                    .join(", ") || "none recorded"
                }]`,
                matchedRow.notes.trim(),
              ]
                .filter(Boolean)
                .join(" ")
            : "",
        };
      });

      const payload = {
        overallNotes: [
          `GRN: ${targetGrnNumber || previewGrnNo}`,
          `Outcome: ${qaVerificationChoice || "Completed"}`,
        ]
          .filter(Boolean)
          .join(" | "),
        items: payloadItems,
      };

      const res = await receiving.completeInspection(inspection.inspectionId, payload);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to complete Quality Assurance inspection.");
      }

      const grnRes = await receiving.getReceipt(targetGrnId);
      const finalGrn: GRN = grnRes.data?.data || resolvedGrn!;

      setConfirmFinishGrnOpen(false);
      onSuccess(finalGrn);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to complete Goods Receipt Note Quality Assurance."
      );
      setConfirmFinishGrnOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Export Report Generation (PDF) — official Bren Raphael's template
  const handleExportGrnReport = async () => {
    if (!isReadyToSignOff) return;

    try {
      const grnNo = activeGrn?.grnNumber || previewGrnNo;
      await downloadGrnReportPdf({
        grnNumber: grnNo,
        deliveryNumber: selected?.deliveryNumber || activeGrn?.deliveryNumber,
        poNumber: selected?.poNumber || activeGrn?.poNumber,
        supplierName: selected?.supplierName || activeGrn?.supplierName,
        carrier: selected?.carrier || activeGrn?.carrier,
        deliveryNoteNumber: activeGrn?.deliveryNoteNumber || selected?.deliveryNumber,
        receivedDate: activeGrn?.receivedDate || new Date().toISOString(),
        status: "QaCompleted",
        receivedBy: activeGrn?.receivedBy || "Commissary Warehouse Receiving",
        inspectorName: "Quality Assurance Department",
        notes: notes.trim() || undefined,
        items: qaRows.map((row) => {
          const source = items.find((s) => s.itemId === row.itemId);
          return {
            itemId: row.itemId,
            itemName: row.itemName,
            categoryName: row.categoryName,
            declaredQuantity: source?.declared ?? row.deliveredQuantity,
            deliveredQuantity: row.deliveredQuantity,
            acceptedQuantity: row.acceptedQuantity,
            rejectedQuantity: row.rejectedQuantity,
            acceptedReason: row.acceptedReason,
            defectReason: row.defectReason,
            expiryDate: row.expiryDate || source?.batches[0]?.expiryDate || null,
            notes: row.notes,
          };
        }),
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  const renderItemTableSection = (groupItems: ItemRow[], title: string) => {
    if (groupItems.length === 0) return null;
    const showExpiryCol = groupItems.some((item) => item.hasExpiry);

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="type-nav-group text-ink-muted">
            {title} ({groupItems.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-divider">
                <th className="pb-2.5 pt-1 pr-2 type-table-header text-ink-muted font-medium whitespace-nowrap">
                  Item
                </th>
                <th className="pb-2.5 pt-1 px-2 type-table-header text-ink-muted font-medium text-right whitespace-nowrap">
                  Declared
                </th>
                <th className="pb-2.5 pt-1 px-2 type-table-header text-ink-muted font-medium text-right whitespace-nowrap">
                  Actual
                </th>
                {showExpiryCol && (
                  <th className="pb-2.5 pt-1 px-2 type-table-header text-ink-muted font-medium whitespace-nowrap">
                    Expiry Date <span className="text-destructive">*</span>
                  </th>
                )}
                <th className="pb-2.5 pt-1 px-2 type-table-header text-ink-muted font-medium text-center whitespace-nowrap">
                  Variance
                </th>
                <th className="pb-2.5 pt-1 pl-2 type-table-header text-ink-muted font-medium text-right whitespace-nowrap">
                  Batch
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {groupItems.map((item) => {
                const itemIndex = items.findIndex((i) => i.deliveryItemId === item.deliveryItemId);
                const actualTotal = getItemTotalActual(item);
                const hasQty = hasAnyQty(item);
                const variance = hasQty ? actualTotal - item.declared : null;

                return (
                  <React.Fragment key={item.deliveryItemId}>
                    <tr className="hover:bg-page transition-colors">
                      <td className="py-3 pr-2 align-middle min-w-[110px]">
                        <div className="type-body-secondary font-medium text-ink leading-snug">
                          {item.itemName}
                        </div>
                        <div className="type-caption text-ink-muted">{item.uom}</div>
                      </td>
                      <td className="py-3 px-2 text-right type-body-secondary font-semibold text-ink-secondary tabular-nums whitespace-nowrap align-middle">
                        {item.declared}
                      </td>
                      <td className="py-3 px-2 text-right align-middle">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`Actual received for ${item.itemName} batch 1`}
                            value={
                              item.batches[0].deliveredQuantity === ""
                                ? ""
                                : item.batches[0].deliveredQuantity
                            }
                            placeholder="0"
                            onKeyDown={(e) => {
                              if (e.key === "-" || e.key === "e") e.preventDefault();
                            }}
                            onChange={(e) => updateBatchQuantity(itemIndex, 0, e.target.value)}
                            className={`h-9 w-20 rounded-control border ${
                              fieldErrors[`qty_${itemIndex}_0`]
                                ? "!border-destructive text-destructive focus:ring-destructive"
                                : "border-border"
                            } bg-surface px-2 text-right type-body-secondary font-semibold text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring`}
                          />
                          {fieldErrors[`qty_${itemIndex}_0`] && (
                            <span className="type-caption text-destructive font-medium mt-0.5 whitespace-nowrap">
                              {fieldErrors[`qty_${itemIndex}_0`]}
                            </span>
                          )}
                        </div>
                      </td>
                      {showExpiryCol && (
                        <td className="py-3 px-2 align-middle">
                          {item.hasExpiry ? (
                            <div className="flex flex-col">
                              <div className="relative w-[132px]">
                                <input
                                  type="date"
                                  aria-label={`Expiry date for ${item.itemName} batch 1`}
                                  min={getTodayDateString()}
                                  max={getMaxFutureDateString()}
                                  value={item.batches[0].expiryDate}
                                  onChange={(e) => updateBatchExpiry(itemIndex, 0, e.target.value)}
                                  className={`h-9 w-full rounded-control border ${
                                    fieldErrors[`expiry_${itemIndex}_0`]
                                      ? "!border-destructive text-destructive focus:ring-destructive"
                                      : "border-border"
                                  } bg-surface pl-2 pr-7 type-caption text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                                />
                                <Calendar className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
                              </div>
                              {fieldErrors[`expiry_${itemIndex}_0`] && (
                                <span className="type-caption text-destructive font-medium mt-0.5 whitespace-nowrap">
                                  {fieldErrors[`expiry_${itemIndex}_0`]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="type-caption text-ink-muted whitespace-nowrap">
                              No Expiry
                            </span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-2 text-center whitespace-nowrap align-middle">
                        {variance === null ? (
                          <span className="type-caption text-ink-muted">—</span>
                        ) : variance === 0 ? (
                          <span className="inline-flex items-center rounded-pill bg-status-green-bg px-2 py-0.5 type-badge text-status-green-fg">
                            Match
                          </span>
                        ) : variance < 0 ? (
                          <span className="inline-flex items-center rounded-pill bg-status-red-bg px-2 py-0.5 type-badge text-status-red-fg">
                            Short {Math.abs(variance)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-pill bg-status-amber-bg px-2 py-0.5 type-badge text-status-amber-fg">
                            Over +{variance}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-2 text-right whitespace-nowrap align-middle">
                        <button
                          type="button"
                          onClick={() => addBatch(itemIndex)}
                          className="inline-flex items-center gap-1 rounded-control border border-border bg-surface px-2 h-8 type-caption font-medium text-primary hover:bg-subtle transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Add Batch</span>
                        </button>
                      </td>
                    </tr>

                    {item.batches.slice(1).map((batch, subIdx) => {
                      const batchIndex = subIdx + 1;
                      return (
                        <tr key={batch.id} className="bg-page/70">
                          <td className="py-2.5 pr-2 pl-4 align-middle">
                            <div className="flex items-center gap-2 type-caption font-medium text-ink-secondary">
                              <span className="w-1.5 h-1.5 rounded-pill bg-primary/60" />
                              <span>Batch #{batchIndex + 1}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right type-caption text-ink-muted align-middle">
                            —
                          </td>
                          <td className="py-2.5 px-2 text-right align-middle">
                            <div className="flex flex-col items-end">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                aria-label={`Actual received for ${item.itemName} batch ${batchIndex + 1}`}
                                value={
                                  batch.deliveredQuantity === "" ? "" : batch.deliveredQuantity
                                }
                                placeholder="0"
                                onKeyDown={(e) => {
                                  if (e.key === "-" || e.key === "e") e.preventDefault();
                                }}
                                onChange={(e) =>
                                  updateBatchQuantity(itemIndex, batchIndex, e.target.value)
                                }
                                className={`h-9 w-20 rounded-control border ${
                                  fieldErrors[`qty_${itemIndex}_${batchIndex}`]
                                    ? "!border-destructive text-destructive focus:ring-destructive"
                                    : "border-border"
                                } bg-surface px-2 text-right type-body-secondary font-semibold text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring`}
                              />
                              {fieldErrors[`qty_${itemIndex}_${batchIndex}`] && (
                                <span className="type-caption text-destructive font-medium mt-0.5 whitespace-nowrap">
                                  {fieldErrors[`qty_${itemIndex}_${batchIndex}`]}
                                </span>
                              )}
                            </div>
                          </td>
                          {showExpiryCol && (
                            <td className="py-2.5 px-2 align-middle">
                              {item.hasExpiry ? (
                                <div className="flex flex-col">
                                  <div className="relative w-[132px]">
                                    <input
                                      type="date"
                                      aria-label={`Expiry date for ${item.itemName} batch ${batchIndex + 1}`}
                                      min={getTodayDateString()}
                                      max={getMaxFutureDateString()}
                                      value={batch.expiryDate}
                                      onChange={(e) =>
                                        updateBatchExpiry(itemIndex, batchIndex, e.target.value)
                                      }
                                      className={`h-9 w-full rounded-control border ${
                                        fieldErrors[`expiry_${itemIndex}_${batchIndex}`]
                                          ? "!border-destructive text-destructive focus:ring-destructive"
                                          : "border-border"
                                      } bg-surface pl-2 pr-7 type-caption text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                                    />
                                    <Calendar className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
                                  </div>
                                  {fieldErrors[`expiry_${itemIndex}_${batchIndex}`] && (
                                    <span className="type-caption text-destructive font-medium mt-0.5 whitespace-nowrap">
                                      {fieldErrors[`expiry_${itemIndex}_${batchIndex}`]}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="type-caption text-ink-muted whitespace-nowrap">
                                  No Expiry
                                </span>
                              )}
                            </td>
                          )}
                          <td className="py-2.5 px-2 text-center type-caption text-ink-muted align-middle">
                            —
                          </td>
                          <td className="py-2.5 pl-2 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => removeBatch(itemIndex, batchIndex)}
                              className="p-1.5 rounded-control text-ink-muted hover:text-destructive hover:bg-notice-danger-bg transition-colors cursor-pointer"
                              title="Remove Batch"
                              aria-label={`Remove batch ${batchIndex + 1}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "space-y-4";

  const qaOutcomeBadge = useMemo(() => {
    if (countedQaRows.length === 0) {
      return { label: "Awaiting counts", cls: "bg-status-gray-bg text-status-gray-fg" };
    }
    if (isQaAllAccepted) {
      return { label: "All Accepted", cls: "bg-status-green-bg text-status-green-fg" };
    }
    if (isQaAllRejected) {
      return { label: "All Rejected", cls: "bg-status-red-bg text-status-red-fg" };
    }
    return { label: "Partial Accept", cls: "bg-status-amber-bg text-status-amber-fg" };
  }, [countedQaRows.length, isQaAllAccepted, isQaAllRejected]);

  return (
    <>
      <div className={containerClasses}>
        {/* Top Back Breadcrumb & Page Title (Page Mode — Matching PR Redesign) */}
        {variant === "page" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Goods receipt notes</span>
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="type-page-title text-ink">New goods receipt note</h1>
              <span className="inline-flex items-center rounded-pill bg-status-purple-bg px-2.5 py-0.5 type-badge text-status-purple-fg">
                Receiving &amp; QA
              </span>
            </div>
            <p className="type-body text-ink-muted">
              Record physical counts, verify expiry dates, and complete Quality Assurance review for
              an arrived delivery.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="rounded-control border border-notice-danger-border bg-notice-danger-bg px-4 py-3 type-caption text-notice-danger-text flex items-start justify-between gap-3"
          >
            <span className="whitespace-pre-line leading-relaxed font-medium">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-semibold underline ml-2 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main 2-Column Layout (Matching Figma Form · New goods receipt note 142:21) */}
        <div
          className={
            variant === "page"
              ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start"
              : "space-y-4"
          }
        >
          {/* Left Column: 5 Clean Cards */}
          <div className="min-w-0 space-y-5">
            {/* Card 1: Receipt & delivery details */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <h2 className="type-subsection text-ink">Receipt &amp; delivery details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                {/* Goods Receipt Note No. */}
                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Goods Receipt Note No.
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary select-all tabular-nums">
                    {activeGrn?.grnNumber || previewGrnNo}
                  </div>
                </div>

                {/* Received Date */}
                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Received Date
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                    {todayDisplay}
                  </div>
                </div>

                {/* Select Delivery */}
                <div>
                  <label
                    className={`mb-1.5 block type-label-field whitespace-nowrap ${
                      fieldErrors.delivery ? "text-destructive" : "text-ink"
                    }`}
                  >
                    Select Delivery <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <select
                      aria-label="Select Delivery"
                      value={selected?.deliveryId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.delivery;
                          return copy;
                        });
                        if (!val) {
                          setSelected(null);
                          setItems([]);
                          setQaByBatchId({});
                          setExpandedQaBatches({});
                          setActiveGrn(null);
                          setQaInspection(null);
                          return;
                        }
                        const id = Number(val);
                        const target = deliveries.find((d) => d.deliveryId === id);
                        if (target) loadSource(target);
                      }}
                      className={`w-full h-9 appearance-none rounded-control border ${
                        fieldErrors.delivery
                          ? "!border-destructive focus:ring-destructive"
                          : "border-border"
                      } bg-surface pl-3 pr-9 py-1.5 type-body-secondary text-ink transition-colors cursor-pointer focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none`}
                    >
                      <option value="">Select Delivery</option>
                      {deliveries.map((d) => (
                        <option key={d.deliveryId} value={d.deliveryId}>
                          {d.deliveryNumber}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  </div>
                  {fieldErrors.delivery && (
                    <p className="mt-1 type-caption font-medium text-destructive">
                      {fieldErrors.delivery}
                    </p>
                  )}
                </div>

                {/* Supplier */}
                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Supplier
                  </label>
                  <div
                    className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate"
                    title={selected?.supplierName || undefined}
                  >
                    {selected?.supplierName || "—"}
                  </div>
                </div>

                {/* Purchase Order Ref. */}
                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Purchase Order Ref.
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary tabular-nums">
                    {selected?.poNumber || "—"}
                  </div>
                </div>

                {/* Carrier / Vehicle */}
                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Carrier / Vehicle
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                    {selected?.carrier && selected.carrier !== "N/A" ? selected.carrier : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Empty state when no delivery chosen */}
            {!selected && !loading && (
              <div className="rounded-card border border-dashed border-border bg-surface p-10 text-center">
                <p className="type-body-strong text-ink-secondary">No delivery selected</p>
                <p className="mt-1 type-caption text-ink-muted">
                  Choose an arrived delivery above to enter physical counts and complete Quality
                  Assurance review.
                </p>
              </div>
            )}

            {loading && <ReceivingSkeleton />}

            {selected && !loading && (
              <>
                {/* Card 2: Physical count & expiry verification */}
                <div className="rounded-card border border-border bg-surface p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="type-subsection text-ink">
                        {items.some((i) => i.hasExpiry)
                          ? "Physical count & expiry verification"
                          : "Physical count verification"}{" "}
                        <span className="text-destructive">*</span>
                      </h2>
                      <p className="mt-0.5 type-caption text-ink-muted">
                        {items.some((i) => i.hasExpiry)
                          ? 'Enter actual counts and expiry dates for each item. Click "+ Add Batch" if received across multiple lots or expiry dates.'
                          : 'Enter actual counts for each item. Click "+ Add Batch" if received across multiple lots.'}
                      </p>
                    </div>
                    <span className="type-caption font-medium text-ink-muted tabular-nums">
                      {items.length} item(s) loaded
                    </span>
                  </div>

                  <div className="space-y-5">
                    {renderItemTableSection(rawMaterials, "Raw Materials")}
                    {renderItemTableSection(toolsAndSupplies, "Tools and Supplies")}
                  </div>
                </div>

                {/* Card 3: Receiving check */}
                <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="type-subsection text-ink">Receiving check</h2>
                    <span className="type-caption text-ink-muted tabular-nums">
                      {verifiedChecksCount} / {receivingChecks.length} verified
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {receivingChecks.map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 rounded-control border border-border bg-surface px-3.5 py-2.5 type-body-secondary text-ink cursor-pointer hover:bg-page transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!verified[key]}
                          onChange={(e) =>
                            setVerified((v) => ({ ...v, [key]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Card 4: Quality assurance review (UNIFIED ON SAME PAGE) */}
                <div className="rounded-card border border-border bg-surface p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="type-subsection text-ink">
                        Quality assurance review <span className="text-destructive">*</span>
                      </h2>
                      <p className="mt-0.5 type-caption text-ink-muted">
                        Count what passed and what failed for each received batch. Passed units
                        proceed to Stock-In; rejected units automatically log a Discrepancy.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 type-badge shrink-0 ${qaOutcomeBadge.cls}`}
                    >
                      {qaOutcomeBadge.label}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {qaRows.map((qaRow) => {
                      const checksList = getQaChecks(qaRow);
                      const allChecked = checksList.every((c) => qaRow.checks[c.id]);
                      const isExpanded = expandedQaBatches[qaRow.batchId] ?? true;
                      const accNum = Number(qaRow.acceptedQuantity || 0);
                      const rejNum = Number(qaRow.rejectedQuantity || 0);
                      const hasDelivered = qaRow.deliveredQuantity > 0;

                      return (
                        <div
                          key={qaRow.batchId}
                          className="rounded-inner border border-border bg-surface overflow-hidden"
                        >
                          {/* Item QA Accordion Header */}
                          <button
                            type="button"
                            onClick={() => toggleExpandQaBatch(qaRow.batchId)}
                            className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-page border-b border-divider text-left cursor-pointer hover:bg-subtle/60 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="type-body-secondary font-semibold text-ink">
                                {qaRow.itemName}
                              </span>
                              <span className="inline-flex items-center rounded-pill bg-status-gray-bg px-2 py-0.5 type-badge-compact text-status-gray-fg">
                                {qaRow.categoryName || "Raw Materials"}
                              </span>
                              {qaRow.totalBatches > 1 && (
                                <span className="inline-flex items-center rounded-pill bg-surface border border-border px-2 py-0.5 type-badge-compact text-ink-secondary">
                                  Batch #{qaRow.batchNumber} of {qaRow.totalBatches}
                                </span>
                              )}
                              {qaRow.expiryDate && (
                                <span className="inline-flex items-center rounded-pill bg-status-purple-bg px-2 py-0.5 type-badge-compact text-status-purple-fg">
                                  Exp: {qaRow.expiryDate}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3.5 shrink-0">
                              <span className="type-caption text-ink-muted tabular-nums">
                                Received:{" "}
                                <strong className="font-semibold text-ink">
                                  {qaRow.deliveredQuantity}
                                </strong>
                              </span>
                              {hasDelivered && (
                                <span className="type-caption font-semibold text-status-green-fg tabular-nums">
                                  Good: {accNum}
                                </span>
                              )}
                              {rejNum > 0 && (
                                <span className="type-caption font-semibold text-destructive tabular-nums">
                                  Bad: {rejNum}
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-ink-muted" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-ink-muted" />
                              )}
                            </div>
                          </button>

                          {/* Item QA Accordion Body */}
                          {isExpanded && (
                            <div className="p-4 space-y-4">
                              {!hasDelivered ? (
                                <div className="rounded-control border border-dashed border-border bg-page px-4 py-3 type-caption text-ink-muted">
                                  Enter the{" "}
                                  <strong className="font-medium text-ink">Actual Received</strong>{" "}
                                  quantity for {qaRow.itemName}
                                  {qaRow.totalBatches > 1 ? ` (Batch #${qaRow.batchNumber})` : ""}{" "}
                                  above to inspect accepted and rejected units.
                                </div>
                              ) : (
                                <>
                                  {/* 1. Accepted (Good) & Rejected (Bad) Split */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {/* Accepted Box */}
                                    <div className="space-y-2.5 p-3.5 rounded-control border border-border bg-page">
                                      <div>
                                        <label className="mb-1.5 block type-label-field text-ink">
                                          Accepted / Good (units){" "}
                                          <span className="text-destructive">*</span>
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max={qaRow.deliveredQuantity}
                                          aria-label={`Accepted units for ${qaRow.itemName}`}
                                          value={qaRow.acceptedQuantity}
                                          onChange={(e) =>
                                            handleSetAccepted(
                                              qaRow.batchId,
                                              qaRow.deliveredQuantity,
                                              e.target.value
                                            )
                                          }
                                          className="w-full h-9 rounded-control border border-border bg-surface px-3 type-body-secondary font-semibold text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                                        />
                                      </div>

                                      {accNum > 0 && (
                                        <div>
                                          <label className="mb-1.5 block type-caption font-medium text-ink-muted">
                                            Acceptance Reason{" "}
                                            <span className="text-destructive">*</span>
                                          </label>
                                          <div className="relative">
                                            <select
                                              aria-label={`Acceptance reason for ${qaRow.itemName}`}
                                              value={qaRow.acceptedReason}
                                              onChange={(e) =>
                                                updateQaField(qaRow.batchId, {
                                                  acceptedReason: e.target.value,
                                                })
                                              }
                                              className="w-full h-9 appearance-none rounded-control border border-border bg-surface pl-3 pr-8 type-caption text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                            >
                                              {acceptanceReasons.map((r) => (
                                                <option key={r} value={r}>
                                                  {r}
                                                </option>
                                              ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Rejected Box */}
                                    <div className="space-y-2.5 p-3.5 rounded-control border border-border bg-page">
                                      <div>
                                        <label className="mb-1.5 block type-label-field text-ink">
                                          Rejected / Bad (units){" "}
                                          <span className="text-destructive">*</span>
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max={qaRow.deliveredQuantity}
                                          aria-label={`Rejected units for ${qaRow.itemName}`}
                                          value={qaRow.rejectedQuantity}
                                          onChange={(e) =>
                                            handleSetRejected(
                                              qaRow.batchId,
                                              qaRow.deliveredQuantity,
                                              e.target.value
                                            )
                                          }
                                          className="w-full h-9 rounded-control border border-border bg-surface px-3 type-body-secondary font-semibold text-destructive tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                                        />
                                      </div>

                                      {rejNum > 0 ? (
                                        <div className="space-y-1.5">
                                          <label className="block type-caption font-medium text-ink-muted">
                                            Rejection Reason{" "}
                                            <span className="text-destructive">*</span>
                                          </label>
                                          <div className="relative">
                                            <select
                                              aria-label={`Rejection reason for ${qaRow.itemName}`}
                                              value={qaRow.defectReason}
                                              onChange={(e) =>
                                                updateQaField(qaRow.batchId, {
                                                  defectReason: e.target.value,
                                                })
                                              }
                                              className={`w-full h-9 appearance-none rounded-control border ${
                                                !qaRow.defectReason
                                                  ? "!border-destructive"
                                                  : "border-border"
                                              } bg-surface pl-3 pr-8 type-caption text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer`}
                                            >
                                              <option value="">Select defect reason</option>
                                              {defectReasons.map((r) => (
                                                <option key={r} value={r}>
                                                  {r}
                                                </option>
                                              ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
                                          </div>
                                          <p className="type-caption text-destructive">
                                            Notice: Rejected units will automatically log a
                                            Discrepancy record for resolution.
                                          </p>
                                        </div>
                                      ) : (
                                        <p className="type-caption text-ink-muted leading-relaxed">
                                          If rejected units &gt; 0, a Defect Reason is required and
                                          a Discrepancy is logged automatically.
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* 2. Quality Assurance Checklist */}
                                  <div className="p-3.5 rounded-control border border-border bg-surface space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="type-nav-group text-ink">
                                        Quality Assurance Checklist
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => toggleCheckAll(qaRow)}
                                        className="type-caption font-medium text-primary hover:underline cursor-pointer"
                                      >
                                        {allChecked ? "Uncheck All" : "Check All"}
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {checksList.map((check) => (
                                        <label
                                          key={check.id}
                                          className="flex items-start gap-2 type-caption text-ink cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!qaRow.checks[check.id]}
                                            onChange={() => toggleQaCheck(qaRow.batchId, check.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0 cursor-pointer"
                                          />
                                          <span className="leading-snug">{check.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 3. Optional Item Remarks */}
                                  <div className="space-y-1.5">
                                    <label className="block type-label-field text-ink">
                                      Item Remarks{" "}
                                      <span className="type-caption font-normal text-ink-muted">
                                        (Optional)
                                      </span>
                                    </label>
                                    <input
                                      type="text"
                                      value={qaRow.notes}
                                      onChange={(e) =>
                                        updateQaField(qaRow.batchId, { notes: e.target.value })
                                      }
                                      placeholder="Add sensory findings, packaging observations, or batch notes..."
                                      className="w-full h-9 rounded-control border border-border bg-surface px-3 type-body-secondary text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card 5: Receiving gate notes */}
                <div className="rounded-card border border-border bg-surface p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="type-subsection text-ink">
                      Receiving gate notes{" "}
                      <span className="type-caption font-normal text-ink-muted">(Optional)</span>
                    </h2>
                    <span className="type-caption text-ink-muted tabular-nums">
                      {notes.length} chars
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-control border border-border bg-surface px-3 py-2.5 type-body-secondary text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    placeholder="Document quantity differences, packaging condition, or gate inspection notes."
                  />
                </div>
              </>
            )}
          </div>

          {/* Right Column: Receipt Summary Card (Page Mode — Matching Requisition Summary) */}
          {variant === "page" && (
            <div className="space-y-5 xl:sticky xl:top-5">
              <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
                <h2 className="type-subsection text-ink">Receipt summary</h2>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">GRN No.</span>
                    <span className="font-medium text-ink tabular-nums">
                      {activeGrn?.grnNumber || previewGrnNo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Status</span>
                    <span className="font-medium text-ink">Draft · Pending QA</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Delivery No.</span>
                    <span className="font-medium text-ink tabular-nums">
                      {selected?.deliveryNumber || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Purchase Order</span>
                    <span className="font-medium text-ink tabular-nums">
                      {selected?.poNumber || "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Supplier</span>
                    <span className="font-medium text-ink text-right break-words">
                      {selected?.supplierName || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Received Date</span>
                    <span className="font-medium text-ink">{todayDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Receiving Checks</span>
                    <span
                      className={`font-medium tabular-nums ${
                        verifiedChecksCount === receivingChecks.length
                          ? "text-status-green-fg"
                          : "text-ink"
                      }`}
                    >
                      {verifiedChecksCount} / {receivingChecks.length} verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">QA Outcome</span>
                    <span
                      className={`font-medium ${
                        countedQaRows.length === 0
                          ? "text-ink-muted"
                          : isQaAllAccepted
                          ? "text-status-green-fg"
                          : isQaAllRejected
                          ? "text-destructive"
                          : "text-status-amber-fg"
                      }`}
                    >
                      {qaOutcomeBadge.label}
                    </span>
                  </div>
                </div>

                <div className="border-t border-divider pt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="type-subsection text-ink">Total items counted</span>
                    <span className="type-card-title text-primary tabular-nums">
                      {totalCountedItems} / {items.length}
                    </span>
                  </div>
                  {totalDeliveredUnits > 0 && (
                    <div className="flex items-center justify-between gap-3 type-caption">
                      <span className="text-ink-muted">QA Accepted / Rejected</span>
                      <span className="font-semibold tabular-nums">
                        <span className="text-status-green-fg">{totalAcceptedUnits} good</span>
                        <span className="text-ink-muted mx-1">·</span>
                        <span
                          className={
                            totalRejectedUnits > 0 ? "text-destructive" : "text-ink-muted"
                          }
                        >
                          {totalRejectedUnits} bad
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar (Non-sticky — Single-row right-aligned buttons matching Figma) */}
        <div
          className={
            variant === "page"
              ? "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-t border-divider pt-4"
              : "flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4"
          }
        >
          {variant === "page" && (
            <p className="type-caption text-ink-muted min-w-0 lg:max-w-[280px] xl:max-w-[340px]">
              Signing off posts the GRN, completes QA review, and releases accepted units for
              Stock-In.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 ml-auto">
            {variant === "modal" ? (
              <ModalNativeCloseButton
                fallbackOnClose={onClose}
                disabled={submitting}
                className="rounded-control border border-border bg-surface px-3.5 h-9 type-label-button-sm text-ink hover:bg-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Cancel
              </ModalNativeCloseButton>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleRequestClose}
                disabled={submitting}
                className="rounded-control border border-border bg-surface px-3.5 h-9 type-label-button-sm text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                Cancel
              </Button>
            )}

            {selected && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setShowRejectModal(true)}
                className="rounded-control border border-border bg-surface px-3.5 h-9 type-label-button-sm text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
              >
                Reject Entire Shipment
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={!isReadyToSignOff || submitting}
              onClick={handleExportGrnReport}
              className="rounded-control border border-border bg-surface px-3.5 h-9 type-label-button-sm text-ink hover:bg-subtle shadow-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>Export GRN</span>
            </Button>

            <Button
              type="button"
              disabled={submitting || !isReadyToSignOff}
              onClick={handlePromptSignOff}
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button-sm hover:bg-primary-hover shadow-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Signing Off..." : "Confirm & Sign Off QA Review"}
            </Button>
          </div>
        </div>
      </div>

      {/* Discard Unsaved Changes Modal (Page Mode) */}
      <ActionConfirmModal
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        subtitle={selected ? `Delivery: ${selected.deliveryNumber}` : undefined}
        description="Are you sure you want to leave this page? Any unsaved physical counts or QA review entries will be lost."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onClose();
        }}
      />

      {/* Reject Entire Shipment Modal (Preserved) */}
      <NestedDialog
        open={showRejectModal}
        title="Reject Entire Shipment"
        onClose={() => setShowRejectModal(false)}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-status-amber-fg">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="type-modal-title text-ink mb-1">Reject Entire Shipment</h2>

          <p className="type-caption font-semibold text-ink-muted mb-3">
            Delivery No: {selected?.deliveryNumber || "—"}
          </p>

          <p className="type-body text-ink-secondary mb-5 leading-relaxed">
            Are you sure you want to reject this entire shipment? This will mark the Goods Receipt
            Note as Rejected and automatically log Discrepancy records for every line item.
          </p>

          <div className="w-full text-left space-y-1.5 mb-4">
            <label className="type-label-field text-ink flex items-center gap-1">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-9 rounded-control border border-border bg-surface text-ink px-3 type-body-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select Reason</option>
              <option value="Severe transit damage to cargo">Severe transit damage to cargo</option>
              <option value="Packaging compromised / contaminated">
                Packaging compromised / contaminated
              </option>
              <option value="Wrong products delivered altogether">
                Wrong products delivered altogether
              </option>
              <option value="Delivery documentation completely missing">
                Delivery documentation completely missing
              </option>
              <option value="Temperature compliance breached">
                Temperature compliance breached
              </option>
              <option value="Expired products on arrival">Expired products on arrival</option>
              <option value="Rejected by commissary gate supervisor">
                Rejected by commissary gate supervisor
              </option>
            </select>
          </div>

          <div className="w-full text-left space-y-1.5 mb-5">
            <label className="type-label-field text-ink block">Additional Remarks</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes or photos reference..."
              className="w-full rounded-control border border-border bg-surface px-3 py-2 type-body-secondary text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              disabled={submitting}
              className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!rejectionReason.trim() || submitting}
              onClick={handleRejectShipment}
              className="flex-1 h-10 px-4 type-label-button text-on-brand bg-primary hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer shadow-none"
            >
              {submitting ? "Rejecting…" : "Confirm Rejection"}
            </button>
          </div>
        </div>
      </NestedDialog>

      {/* Final Confirmation Modal: Confirm & Sign Off QA Review (Preserved) */}
      <NestedDialog
        open={confirmFinishGrnOpen}
        title="Confirm Quality Assurance Review"
        onClose={() => {
          if (!submitting) setConfirmFinishGrnOpen(false);
        }}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-status-amber-fg">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="type-modal-title text-ink mb-1">Confirm Quality Assurance Review</h2>

          <p className="type-caption font-semibold text-ink-muted mb-3">
            Delivery No: {selected?.deliveryNumber || "—"} • GRN No:{" "}
            {activeGrn?.grnNumber || previewGrnNo || "—"}
          </p>

          <p className="type-body text-ink-secondary mb-6 leading-relaxed">
            You are recording physical counts and approving{" "}
            <strong className="text-ink font-semibold">{totalAcceptedUnits} unit(s)</strong> across{" "}
            <strong className="text-ink font-semibold">{qaRows.length} item batch(es)</strong> to
            proceed to Stock-In
            {totalRejectedUnits > 0
              ? ` and logging ${totalRejectedUnits} rejected unit(s) for discrepancy resolution`
              : ""}
            . Are you sure you want to sign off and complete this Goods Receipt Note?
          </p>

          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setConfirmFinishGrnOpen(false)}
              disabled={submitting}
              className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={executeUnifiedSignOff}
              className="flex-1 h-10 px-4 type-label-button text-on-brand bg-primary hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer shadow-none"
            >
              {submitting ? "Signing Off..." : "Sign Off & Complete"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </>
  );
}

/**
 * Full-page unified Create GRN + Quality Assurance form matching Figma 142:21.
 */
export function CreateGrnForm({
  initialDeliveryId,
  initialDeliveries,
  initialReceipts,
  onClose,
  onSuccess,
  embedded = false,
}: CreateGrnFormProps) {
  return (
    <CreateGrnBody
      active={true}
      variant="page"
      embedded={embedded}
      initialDeliveryId={initialDeliveryId}
      initialDeliveries={initialDeliveries}
      initialReceipts={initialReceipts}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

/**
 * Backward-compatible modal wrapper (used by DeliveryDetailsModal or modal callers).
 */
export default function CreateGrnModal({
  open,
  initialDeliveryId,
  initialDeliveries,
  initialReceipts,
  onClose,
  onSuccess,
}: CreateGrnModalProps) {
  return (
    <ModalWrapper
      open={open}
      title="Create Goods Receipt Note"
      onClose={onClose}
      size="max-w-[780px]"
    >
      <CreateGrnBody
        active={open}
        variant="modal"
        initialDeliveryId={initialDeliveryId}
        initialDeliveries={initialDeliveries}
        initialReceipts={initialReceipts}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </ModalWrapper>
  );
}
