"use client";
import { receivingDeliveries } from "@/lib/receiving/screen-data";
import { ReceivingSkeleton } from "./ReceivingSkeleton";
import { receiving } from "@/lib/receiving/client";
import { getDeliveryForReceiving, getOrderForReceiving, listDeliveriesForReceiving } from "@/app/actions/receiving/procurement-reads";
import { listItemChoices } from "@/app/actions/receiving/lookups";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, ClipboardCheck, AlertTriangle } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import NestedDialog from "./NestedDialog";
import { ArrivedDelivery, GRN, QAInspection } from "./types";
import { HR_EMPLOYEES } from "@/lib/employees";

interface Props {
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
  ordered: number;
  previous: number;
  declared: number;
  uom: string;
  batches: ItemBatch[];
}

interface QaItemRow {
  inspectionItemId: number;
  itemId: number;
  itemName: string;
  categoryName?: string;
  lotId?: number;
  batchNumber?: number;
  totalBatches?: number;
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

const toolAndSupplyChecks = [
  { id: "identity", label: "Item identity, model, size, and approved specification match" },
  { id: "quantity", label: "Quantity, unit of measure, and pack count verified" },
  { id: "condition", label: "Item is undamaged, clean, and fit for use" },
  { id: "packaging", label: "Packaging and seals are intact where applicable" },
  { id: "safety", label: "Safety, hygiene, and contact-use requirements checked" },
  { id: "documents", label: "Certificate, warranty, expiry, or supplier document reviewed" },
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

export default function CreateGrnModal({
  open,
  initialDeliveryId,
  initialDeliveries,
  initialReceipts,
  onClose,
  onSuccess,
}: Props) {
  // Stepper: Step 1 = Receiving & Physical Count; Step 2 = QA Inspection
  const [step, setStep] = useState<1 | 2>(1);

  const [deliveries, setDeliveries] = useState<ArrivedDelivery[]>(initialDeliveries || []);
  const [selected, setSelected] = useState<ArrivedDelivery | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [previewGrnNo, setPreviewGrnNo] = useState<string>("GRN-Pending");
  const [notes, setNotes] = useState("");
  const categoryCacheRef = useRef<Record<number, string> | null>(null);

  // Step 1: Receiving Check checkboxes
  const [verified, setVerified] = useState<Record<string, boolean>>({
    physicalQuantityVerified: false,
    itemsMatchPurchaseOrder: false,
    supplierDocumentsChecked: false,
    packagingConditionChecked: false,
  });

  // Rejection dialog
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Confirmations
  const [confirmFinishGrnOpen, setConfirmFinishGrnOpen] = useState(false);

  // Step 2: QA state
  const [activeGrn, setActiveGrn] = useState<GRN | null>(null);
  const [qaInspection, setQaInspection] = useState<QAInspection | null>(null);
  const [qaItems, setQaItems] = useState<QaItemRow[]>([]);
  const [inspectorName, setInspectorName] = useState("");
  const [qaOverallNotes, setQaOverallNotes] = useState("");
  const [qaVerificationChoice, setQaVerificationChoice] = useState("");
  const [expandedQaItems, setExpandedQaItems] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setFieldErrors({});
    setItems([]);
    setSelected(null);
    setNotes("");
    setActiveGrn(null);
    setQaInspection(null);
    setQaItems([]);
    setInspectorName("");
    setQaOverallNotes("");
    setQaVerificationChoice("");
    setExpandedQaItems({});
    setShowRejectModal(false);
    setRejectionReason("");
    setConfirmFinishGrnOpen(false);
    setVerified({
      physicalQuantityVerified: false,
      itemsMatchPurchaseOrder: false,
      supplierDocumentsChecked: false,
      packagingConditionChecked: false,
    });

    // Compute preview GRN number from existing receipts immediately if provided
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
      receiving.listReceipts()
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
        .catch(() => setError("Unable to load arrived deliveries. Please refresh and try again."));
    }
  }, [open, initialDeliveryId]);

  const getCategoryMap = async (): Promise<Record<number, string>> => {
    if (categoryCacheRef.current) return categoryCacheRef.current;
    try {
      const itemsCatalogRes = await actionResponse(listItemChoices());
      const catalogItems = Array.isArray(itemsCatalogRes.data?.data?.items)
        ? itemsCatalogRes.data.data.items
        : Array.isArray(itemsCatalogRes.data?.data)
        ? itemsCatalogRes.data.data
        : [];
      const map: Record<number, string> = {};
      catalogItems.forEach((catItem: any) => {
        if (catItem.itemId) {
          map[catItem.itemId] = catItem.categoryName || "";
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
    setItems([]);
    try {
      const [deliveryResult, poResult, categoryMap] = await Promise.all([
        actionResponse(getDeliveryForReceiving(delivery.deliveryId)),
        actionResponse(getOrderForReceiving(delivery.poId)),
        getCategoryMap(),
      ]);

      const poItems = poResult.data?.data?.items || [];
      const rows: ItemRow[] = (deliveryResult.data?.data?.items || []).map((line: any) => {
        const po = poItems.find((p: any) => p.poItemId === line.poItemId) || line;
        const declared = Number(line.declaredQuantity);
        const resolvedCategory =
          categoryMap[line.itemId] ||
          po.categoryName ||
          line.categoryName ||
          "Raw Materials";

        return {
          poItemId: line.poItemId,
          deliveryItemId: line.deliveryItemId,
          itemId: line.itemId,
          itemName: line.itemName || `Item #${line.itemId}`,
          categoryName: resolvedCategory,
          ordered: Number(po.quantity ?? line.poOrderedQuantity ?? 0),
          previous: Number(po.receivedQuantity ?? line.poTotalReceivedQuantity ?? 0),
          declared,
          uom: line.purchaseUomName || line.uomName || "Unit",
          batches: [
            {
              id: `batch-${Date.now()}-${Math.random()}`,
              expiryDate: "",
              deliveredQuantity: "",
            },
          ],
        };
      });
      setItems(rows);
    } catch {
      setError("Unable to load delivery source lines.");
    } finally {
      setLoading(false);
    }
  };

  const updateBatchQuantity = (itemIndex: number, batchIndex: number, value: string) => {
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[`qty_${itemIndex}_${batchIndex}`];
      return copy;
    });
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        const newBatches: ItemBatch[] = item.batches.map((b, bi) => {
          if (bi !== batchIndex) return b;
          const qty: number | "" = value.trim() === "" ? "" : Math.max(0, Number(value));
          return {
            ...b,
            deliveredQuantity: qty,
          };
        });
        return { ...item, batches: newBatches };
      })
    );
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
    setItems((current) =>
      current.map((item, i) => {
        if (i !== itemIndex) return item;
        return {
          ...item,
          batches: [
            ...item.batches,
            {
              id: `batch-${Date.now()}-${Math.random()}`,
              expiryDate: "",
              deliveredQuantity: "",
            },
          ],
        };
      })
    );
  };

  const removeBatch = (itemIndex: number, batchIndex: number) => {
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
  };

  const getItemTotalActual = (item: ItemRow): number => {
    return item.batches.reduce((sum, b) => {
      const q = typeof b.deliveredQuantity === "number" ? b.deliveredQuantity : 0;
      return sum + q;
    }, 0);
  };

  const hasAnyQty = (item: ItemRow): boolean => {
    return item.batches.some(
      (b) => b.deliveredQuantity !== "" && typeof b.deliveredQuantity === "number" && b.deliveredQuantity > 0
    );
  };

  const isItemExpiryRequired = (item: ItemRow): boolean => {
    const isToolOrSupply =
      item.categoryName?.toLowerCase().includes("tool") ||
      item.categoryName?.toLowerCase().includes("suppl") ||
      item.categoryName?.toLowerCase().includes("equip");
    return !isToolOrSupply;
  };

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

  const isReadyForQa = Boolean(
    selected &&
      items.length > 0 &&
      items.every((item) => isItemCounted(item)) &&
      Object.keys(fieldErrors).length === 0
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

  // STEP 1 Action: Reject Entire Shipment at gate
  const handleRejectShipment = async () => {
    if (!selected) return;
    if (!rejectionReason.trim()) {
      setError("Please provide a reason for rejecting the shipment.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const requestItems = items.length > 0
        ? items.flatMap((i) =>
            i.batches.map((b) => ({
              poItemId: i.poItemId,
              deliveryItemId: i.deliveryItemId,
              itemId: i.itemId,
              deliveredQuantity: Number(b.deliveredQuantity) || 0,
              expiryDate: b.expiryDate ? `${b.expiryDate.split("T")[0]}T12:00:00Z` : undefined,
            }))
          )
        : (selected.items || []).map((line) => ({
            poItemId: line.poItemId,
            deliveryItemId: line.deliveryItemId,
            itemId: line.itemId,
            deliveredQuantity: 0,
          }));

      // Reuse existing Draft GRN for this delivery if present
      const existingGrnRes = await receiving.listReceipts(`deliveryId=${selected.deliveryId}`);
      const existingGrns: GRN[] = Array.isArray(existingGrnRes.data?.data) ? existingGrnRes.data.data : [];
      const activeOrDraft = existingGrns.find(
        (g) => g.deliveryId === selected.deliveryId && g.status !== "Cancelled" && g.status !== "Rejected"
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

  // STEP 1 Action: Proceed to QA Step in same modal
  const executeProceedToQa = async () => {
    if (!selected) {
      setFieldErrors({ delivery: "Please select an arrived delivery." });
      return;
    }

    if (items.length === 0) {
      setError("No items found for this delivery.");
      return;
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
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let resolvedGrn: GRN | null = null;

      const existingGrnRes = await receiving.listReceipts(`deliveryId=${selected.deliveryId}`);
      const existingGrns: GRN[] = Array.isArray(existingGrnRes.data?.data) ? existingGrnRes.data.data : [];

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
          expiryDate: b.expiryDate ? b.expiryDate.split("T")[0] : undefined,
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
          // Update existing draft with current physical counts before posting
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
      let inspection: QAInspection | null = null;
      try {
        const qaRes = await receiving.listInspections(`grnId=${targetGrnId}`);
        const inspectionList: QAInspection[] = Array.isArray(qaRes.data?.data)
          ? qaRes.data.data
          : Array.isArray(qaRes.data)
          ? qaRes.data
          : [];
        inspection = inspectionList[0] || null;
      } catch (qcFetchErr) {
        console.warn("Could not fetch QA inspection directly:", qcFetchErr);
      }

      setQaInspection(inspection);

      const sourceItemsList =
        inspection?.items && inspection.items.length > 0
          ? inspection.items
          : items.flatMap((src) =>
              src.batches.map((b, bIdx) => ({
                itemId: src.itemId,
                itemName: src.itemName,
                categoryName: src.categoryName,
                deliveredQuantity: Number(b.deliveredQuantity) || 0,
                lotId: undefined,
                batchNumber: bIdx + 1,
                totalBatches: src.batches.length,
                expiryDate: b.expiryDate ? b.expiryDate.split("T")[0] : undefined,
              }))
            );

      const itemBatchCounters: Record<number, number> = {};
      const qaRows: QaItemRow[] = sourceItemsList.map((qItem: any, idx: number) => {
        const itemId = qItem.itemId;
        const currentCount = itemBatchCounters[itemId] || 0;
        itemBatchCounters[itemId] = currentCount + 1;

        const matchingSource = items.find((src) => src.itemId === itemId);
        const matchingBatch = matchingSource?.batches?.[currentCount] || matchingSource?.batches?.[0];
        const batchNum = qItem.batchNumber || currentCount + 1;
        const totalBatches = qItem.totalBatches || matchingSource?.batches?.length || 1;
        const expiry =
          qItem.lot?.expiryDate?.split("T")[0] ||
          qItem.expiryDate?.split("T")[0] ||
          (matchingBatch?.expiryDate ? matchingBatch.expiryDate.split("T")[0] : undefined);

        const deliveredQty =
          Number(qItem.deliveredQuantity) ||
          Number(matchingBatch?.deliveredQuantity) ||
          (matchingSource ? getItemTotalActual(matchingSource) : 0);

        return {
          inspectionItemId: qItem.inspectionItemId || idx + 1,
          itemId: qItem.itemId,
          itemName: qItem.itemName || matchingSource?.itemName || `Item #${qItem.itemId}`,
          categoryName: matchingSource?.categoryName || "Raw Materials",
          lotId: qItem.lotId || qItem.lot?.lotId,
          batchNumber: batchNum,
          totalBatches: totalBatches,
          expiryDate: expiry,
          deliveredQuantity: deliveredQty,
          acceptedQuantity: deliveredQty,
          acceptedReason: acceptanceReasons[0],
          rejectedQuantity: 0,
          concessionQuantity: 0,
          defectReason: "",
          notes: "",
          checks: Object.fromEntries(
            [...rawMaterialChecks, ...toolAndSupplyChecks].map((c) => [c.id, true])
          ),
        };
      });

      if (!inspectorName && HR_EMPLOYEES.length > 0) {
        setInspectorName(HR_EMPLOYEES[0]);
      }
      setQaItems(qaRows);
      setExpandedQaItems(Object.fromEntries(qaRows.map((r) => [r.inspectionItemId, true])));
      setStep(2);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        "An error occurred while proceeding to QA inspection.";
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // STEP 2 QA Handlers
  const getQaChecks = (item: QaItemRow) => {
    const isTool = /tool|suppl/i.test(item.categoryName || "");
    return isTool ? toolAndSupplyChecks : rawMaterialChecks;
  };

  const handleSetAccepted = (index: number, valStr: string) => {
    setQaItems((prev) => {
      const copy = [...prev];
      if (valStr === "") {
        copy[index] = { ...copy[index], acceptedQuantity: "" };
        return copy;
      }
      const num = Math.max(0, Math.min(copy[index].deliveredQuantity, Number(valStr)));
      const rej = copy[index].deliveredQuantity - num;
      copy[index] = {
        ...copy[index],
        acceptedQuantity: num,
        acceptedReason: num > 0 ? copy[index].acceptedReason || acceptanceReasons[0] : "",
        rejectedQuantity: rej,
        defectReason: rej === 0 ? "" : copy[index].defectReason,
      };
      return copy;
    });
  };

  const handleSetRejected = (index: number, valStr: string) => {
    setQaItems((prev) => {
      const copy = [...prev];
      if (valStr === "") {
        copy[index] = { ...copy[index], rejectedQuantity: "" };
        return copy;
      }
      const num = Math.max(0, Math.min(copy[index].deliveredQuantity, Number(valStr)));
      const acc = copy[index].deliveredQuantity - num;
      copy[index] = {
        ...copy[index],
        rejectedQuantity: num,
        acceptedQuantity: acc,
        acceptedReason: acc > 0 ? copy[index].acceptedReason || acceptanceReasons[0] : "",
        defectReason: num === 0 ? "" : copy[index].defectReason,
      };
      return copy;
    });
  };

  const toggleQaCheck = (itemIndex: number, checkId: string) => {
    setQaItems((prev) => {
      const copy = [...prev];
      const current = copy[itemIndex].checks[checkId] ?? false;
      copy[itemIndex] = {
        ...copy[itemIndex],
        checks: { ...copy[itemIndex].checks, [checkId]: !current },
      };
      return copy;
    });
  };

  const toggleCheckAll = (itemIndex: number) => {
    setQaItems((prev) => {
      const copy = [...prev];
      const item = copy[itemIndex];
      const available = getQaChecks(item);
      const allChecked = available.every((c) => item.checks[c.id]);
      const newChecks = { ...item.checks };
      available.forEach((c) => {
        newChecks[c.id] = !allChecked;
      });
      copy[itemIndex] = { ...item, checks: newChecks };
      return copy;
    });
  };

  const toggleExpandQaItem = (itemId: number) => {
    setExpandedQaItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const isQaAllAccepted = qaItems.length > 0 && qaItems.every((i) => Number(i.acceptedQuantity) === Number(i.deliveredQuantity));
  const isQaAllRejected = qaItems.length > 0 && qaItems.every((i) => Number(i.rejectedQuantity) === Number(i.deliveredQuantity));

  useEffect(() => {
    if (qaItems.length === 0) return;
    if (isQaAllAccepted) setQaVerificationChoice("All Accepted");
    else if (isQaAllRejected) setQaVerificationChoice("All Rejected");
    else setQaVerificationChoice("Partial Accept - Acceptable Quality");
  }, [isQaAllAccepted, isQaAllRejected, qaItems.length]);

  // Check if Step 2 QA is fully completed (Mirrors Production & Quality QA rules)
  const isQaDone = Boolean(
    inspectorName.trim() &&
      qaItems.length > 0 &&
      qaItems.every((i) => {
        const hasAccepted = typeof i.acceptedQuantity === "number" && !isNaN(i.acceptedQuantity);
        const hasRejected = typeof i.rejectedQuantity === "number" && !isNaN(i.rejectedQuantity);
        if (!hasAccepted || !hasRejected) return false;
        if (Number(i.acceptedQuantity) + Number(i.rejectedQuantity) !== Number(i.deliveredQuantity)) return false;
        if (Number(i.acceptedQuantity) > 0 && !i.acceptedReason.trim()) return false;
        if (Number(i.rejectedQuantity) > 0 && !i.defectReason.trim()) return false;
        return true;
      })
  );

  // STEP 2 Action: Finish GRN (Complete QA)
  const executeFinishGrn = async () => {
    if (!activeGrn || !isQaDone) return;

    setSubmitting(true);
    setError(null);
    try {
      let resolvedInspectionId = qaInspection?.inspectionId;
      if (!resolvedInspectionId) {
        const qaRes = await receiving.listInspections(`grnId=${activeGrn.grnId}`);
        const list = Array.isArray(qaRes.data?.data) ? qaRes.data.data : [];
        if (list[0]?.inspectionId) {
          resolvedInspectionId = list[0].inspectionId;
          setQaInspection(list[0]);
        }
      }

      if (!resolvedInspectionId) {
        throw new Error("Unable to locate active quality inspection for this GRN.");
      }

      const payload = {
        overallNotes: [
          `GRN: ${activeGrn.grnNumber}`,
          `Inspector: ${inspectorName.trim()}`,
          `Outcome: ${qaVerificationChoice || "Completed"}`,
          qaOverallNotes.trim(),
        ].filter(Boolean).join(" | "),
        items: qaItems.map((i) => ({
          inspectionItemId: i.inspectionItemId,
          itemId: i.itemId,
          lotId: i.lotId,
          deliveredQuantity: Number(i.deliveredQuantity),
          acceptedQuantity: Number(i.acceptedQuantity),
          rejectedQuantity: Number(i.rejectedQuantity),
          concessionQuantity: Number(i.concessionQuantity),
          defectReason: Number(i.rejectedQuantity) > 0 ? i.defectReason.trim() || undefined : undefined,
          notes: [
            Number(i.acceptedQuantity) > 0 && i.acceptedReason ? `[ACCEPTED: ${i.acceptedReason}]` : "",
            Number(i.rejectedQuantity) > 0 && i.defectReason ? `[REJECTED: ${i.defectReason}]` : "",
            `[QA CHECKS: ${getQaChecks(i).filter((check) => i.checks[check.id]).map((check) => check.id).join(", ") || "none recorded"}]`,
            i.notes.trim(),
          ].filter(Boolean).join(" "),
        })),
      };

      const res = await receiving.completeInspection(resolvedInspectionId, payload);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to complete QA inspection.");
      }

      const grnRes = await receiving.getReceipt(activeGrn.grnId);
      const finalGrn: GRN = grnRes.data?.data || activeGrn;

      setConfirmFinishGrnOpen(false);
      onSuccess(finalGrn);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to complete Goods Receipt Note Quality Assurance.");
      setConfirmFinishGrnOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Export Report Generation (PDF) — keyed strictly by GRN number
  const handleExportGrnReport = async () => {
    if (!isQaDone) return;

    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const grnNo = activeGrn?.grnNumber || previewGrnNo;
      const now = new Date().toLocaleString("en-PH");

      const doc = new jsPDF({ format: "a4", orientation: "portrait" });

      doc.setFontSize(18);
      doc.text("GOODS RECEIPT & QUALITY ASSURANCE REPORT", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Commissary Central Receiving & Quality Control", 14, 28);

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(grnNo, 196, 22, { align: "right" });

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Printed: ${now}`, 196, 28, { align: "right" });

      // Info box
      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 35, 182, 20, "FD");

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(`Supplier: ${selected?.supplierName || "—"}`, 18, 42);
      doc.text(`Carrier: ${selected?.carrier || "—"}`, 18, 49);

      doc.text(`Delivery No: ${selected?.deliveryNumber || "—"}`, 105, 42);
      doc.text(`Inspector: ${inspectorName || "—"}`, 105, 49);

      const tableData = qaItems.map((item) => {
        const source = items.find((s) => s.itemId === item.itemId);
        const expiry = item.expiryDate || source?.batches[0]?.expiryDate || "—";
        const hasRejected = Number(item.rejectedQuantity) > 0;
        const hasAccepted = Number(item.acceptedQuantity) > 0;
        const statusParts = [
          hasAccepted ? `Accepted (${item.acceptedReason})` : "",
          hasRejected ? `Rejected (${item.defectReason})` : "",
          item.notes || "",
        ].filter(Boolean).join(" | ");
        return [
          item.itemName,
          source?.declared ?? item.deliveredQuantity,
          item.deliveredQuantity,
          item.acceptedQuantity,
          item.rejectedQuantity,
          expiry,
          statusParts,
        ];
      });

      autoTable(doc, {
        startY: 65,
        head: [["Item Description", "Declared", "Received", "Accepted", "Rejected", "Expiry", "Quality Assurance Status & Notes"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [244, 244, 245], textColor: 0, fontStyle: "bold" },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      if (qaOverallNotes) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, finalY, 182, 20, "FD");
        doc.text("Inspector Notes:", 18, finalY + 7);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(qaOverallNotes, 174);
        doc.text(lines, 18, finalY + 14);
        finalY += 30;
      }

      finalY += 20;
      doc.setFontSize(9);
      doc.text("Received & Counted By:", 14, finalY);
      doc.line(14, finalY + 15, 64, finalY + 15);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Warehouse Receiving Officer", 14, finalY + 20);

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Quality Inspected By:", 75, finalY);
      doc.line(75, finalY + 15, 125, finalY + 15);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(inspectorName || "Quality Assurance Specialist", 75, finalY + 20);

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Acknowledged / Noted:", 136, finalY);
      doc.line(136, finalY + 15, 196, finalY + 15);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text("Commissary Supervisor", 136, finalY + 20);

      doc.save(`${grnNo}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  const renderItemTableSection = (groupItems: ItemRow[], title: string) => {
    if (groupItems.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
            {title} ({groupItems.length})
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Item Description</th>
                <th className="px-3 py-3 text-right">Declared</th>
                <th className="px-3 py-3 text-right">Actual Received</th>
                <th className="px-3 py-3 text-center">Expiry Date <span className="text-destructive">*</span></th>
                <th className="px-3 py-3 text-center">Variance</th>
                <th className="px-3 py-3 text-right">Batch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {groupItems.map((item) => {
                const itemIndex = items.findIndex((i) => i.deliveryItemId === item.deliveryItemId);
                const actualTotal = getItemTotalActual(item);
                const hasQty = hasAnyQty(item);
                const variance = hasQty ? actualTotal - item.declared : null;

                return (
                  <React.Fragment key={item.deliveryItemId}>
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="font-semibold text-foreground">{item.itemName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.uom} {item.batches.length > 1 ? `· ${item.batches.length} Batches` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">{item.declared}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.batches[0].deliveredQuantity === "" ? "" : item.batches[0].deliveredQuantity}
                            placeholder=""
                            onKeyDown={(e) => {
                              if (e.key === "-" || e.key === "e") e.preventDefault();
                            }}
                            onChange={(e) => updateBatchQuantity(itemIndex, 0, e.target.value)}
                            className={`w-24 rounded-xl border ${
                              fieldErrors[`qty_${itemIndex}_0`]
                                ? "!border-destructive text-destructive focus:!ring-destructive"
                                : "border-border"
                            } bg-background px-2.5 py-1.5 text-right font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-foreground`}
                          />
                          {fieldErrors[`qty_${itemIndex}_0`] && (
                            <span className="text-[10px] text-destructive font-medium mt-0.5 whitespace-nowrap">
                              {fieldErrors[`qty_${itemIndex}_0`]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center">
                          <input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={item.batches[0].expiryDate}
                            onChange={(e) => updateBatchExpiry(itemIndex, 0, e.target.value)}
                            className={`rounded-xl border ${
                              fieldErrors[`expiry_${itemIndex}_0`]
                                ? "!border-destructive text-destructive focus:!ring-destructive"
                                : "border-border"
                            } bg-background px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-foreground`}
                          />
                          {fieldErrors[`expiry_${itemIndex}_0`] && (
                            <span className="text-[10px] text-destructive font-medium mt-0.5 whitespace-nowrap">
                              {fieldErrors[`expiry_${itemIndex}_0`]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-medium">
                        {variance === null ? (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        ) : variance === 0 ? (
                          <span className="font-semibold text-foreground text-xs">Match</span>
                        ) : variance < 0 ? (
                          <span className="text-destructive font-bold text-xs">
                            Short {Math.abs(variance)}
                          </span>
                        ) : (
                          <span className="text-destructive font-bold text-xs">
                            Over +{variance}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => addBatch(itemIndex)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Plus size={14} className="shrink-0" />
                          <span>Add Batch</span>
                        </button>
                      </td>
                    </tr>

                    {item.batches.slice(1).map((batch, subIdx) => {
                      const batchIndex = subIdx + 1;
                      return (
                        <tr key={batch.id} className="bg-muted/15 border-t border-border/40">
                          <td className="px-4 py-2 pl-8 font-medium">
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                              <span>Batch #{batchIndex + 1}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={batch.deliveredQuantity === "" ? "" : batch.deliveredQuantity}
                                placeholder=""
                                onKeyDown={(e) => {
                                  if (e.key === "-" || e.key === "e") e.preventDefault();
                                }}
                                onChange={(e) => updateBatchQuantity(itemIndex, batchIndex, e.target.value)}
                                className={`w-24 rounded-xl border ${
                                  fieldErrors[`qty_${itemIndex}_${batchIndex}`]
                                    ? "!border-destructive text-destructive focus:!ring-destructive"
                                    : "border-border"
                                } bg-background px-2.5 py-1.5 text-right font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-foreground`}
                              />
                              {fieldErrors[`qty_${itemIndex}_${batchIndex}`] && (
                                <span className="text-[10px] text-destructive font-medium mt-0.5 whitespace-nowrap">
                                  {fieldErrors[`qty_${itemIndex}_${batchIndex}`]}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center">
                              <input
                                type="date"
                                min={new Date().toISOString().split("T")[0]}
                                value={batch.expiryDate}
                                onChange={(e) => updateBatchExpiry(itemIndex, batchIndex, e.target.value)}
                                className={`rounded-xl border ${
                                  fieldErrors[`expiry_${itemIndex}_${batchIndex}`]
                                    ? "!border-destructive text-destructive focus:!ring-destructive"
                                    : "border-border"
                                } bg-background px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-foreground`}
                              />
                              {fieldErrors[`expiry_${itemIndex}_${batchIndex}`] && (
                                <span className="text-[10px] text-destructive font-medium mt-0.5 whitespace-nowrap">
                                  {fieldErrors[`expiry_${itemIndex}_${batchIndex}`]}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeBatch(itemIndex, batchIndex)}
                              className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors focus:outline-none"
                              title="Remove Batch"
                            >
                              <Trash2 size={16} className="text-destructive" />
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

  return (
    <>
      <ModalWrapper
        open={open}
        title={
          step === 1
            ? "Create Goods Receipt Note"
            : `Quality Assurance Review — ${activeGrn?.grnNumber || previewGrnNo}`
        }
        onClose={onClose}
        size="max-w-4xl"
      >
        <div className="space-y-4 text-foreground">
          {/* Top Assigned GRN Header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                <span>1</span>
                <span>Receiving &amp; Physical Count</span>
              </div>
              <span className="text-muted-foreground">›</span>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                step === 2 ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              }`}>
                <span>2</span>
                <span>Quality Assurance Review</span>
              </div>
            </div>

            <div className="text-xs font-medium text-muted-foreground">
              Goods Receipt Note: <span className="font-mono font-bold text-foreground">{activeGrn?.grnNumber || previewGrnNo}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-start justify-between gap-3">
              <span className="whitespace-pre-line leading-relaxed">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-foreground font-bold text-xs hover:underline ml-2 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ================= STEP 1: RECEIVING CHECK & PHYSICAL COUNTS ================= */}
          {step === 1 && (
            <>
              <section className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Select Delivery <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <select
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
                        setActiveGrn(null);
                        return;
                      }
                      const id = Number(val);
                      const target = deliveries.find((d) => d.deliveryId === id);
                      if (target) loadSource(target);
                    }}
                    className={`w-64 rounded-xl border ${
                      fieldErrors.delivery
                        ? "!border-destructive focus:!ring-destructive"
                        : "border-border"
                    } bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground cursor-pointer`}
                  >
                    <option value="">Select Delivery</option>
                    {deliveries.map((d) => (
                      <option key={d.deliveryId} value={d.deliveryId}>
                        {d.deliveryNumber}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldErrors.delivery && (
                  <p className="mt-1.5 text-xs font-medium text-destructive animate-in fade-in-50">
                    {fieldErrors.delivery}
                  </p>
                )}

                {selected && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Supplier</span>
                        <span className="font-semibold text-foreground">{selected.supplierName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Delivery No.</span>
                        <span className="font-semibold text-foreground">{selected.deliveryNumber}</span>
                      </div>
                      {selected.carrier && selected.carrier !== "N/A" && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">Carrier</span>
                          <span className="font-semibold text-foreground">{selected.carrier}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {!selected && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  <p className="text-sm font-semibold text-muted-foreground">No delivery selected</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Choose an arrived delivery above to enter physical counts.
                  </p>
                </div>
              )}

              {loading && <ReceivingSkeleton />}

              {selected && !loading && (
                <>
                  <section className="space-y-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">Physical Count &amp; Expiry Verification</p>
                      <p className="text-xs text-muted-foreground">
                        Enter actual counts and expiry dates for each item. Click &quot;Add Batch&quot; on the right if received across multiple lots or expiry dates.
                      </p>
                    </div>

                    {renderItemTableSection(rawMaterials, "Raw Materials")}
                    {renderItemTableSection(toolsAndSupplies, "Tools and Supplies")}
                  </section>

                  <section className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-bold text-foreground">Receiving Check</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {receivingChecks.map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!verified[key]}
                            onChange={(e) => setVerified((v) => ({ ...v, [key]: e.target.checked }))}
                            className="h-4 w-4 rounded border-border text-foreground accent-foreground"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">Receiving Gate Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                      placeholder="Document quantity differences, packaging condition, or gate inspection notes."
                    />
                  </label>
                </>
              )}

              {/* Step 1 Footer Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-3">
                  {selected && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowRejectModal(true)}
                      className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Reject Entire Shipment
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={submitting || !isReadyForQa}
                    onClick={executeProceedToQa}
                    className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                  >
                    {submitting ? "Proceeding…" : "Proceed to Quality Assurance"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ================= STEP 2: QUALITY ASSURANCE REVIEW (Mirroring Production & Quality) ================= */}
          {step === 2 && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-border/60">
                <div>
                  <h3 className="text-base font-bold text-foreground">QA Review</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Count what passed and what failed for each received item. Passed units proceed to Stock-In; rejected units log a Discrepancy.
                  </p>
                </div>
                <label className="block space-y-1 sm:w-64">
                  <span className="text-xs font-semibold text-foreground">
                    Inspector Name <span className="text-destructive">*</span>
                  </span>
                  <select
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="" disabled>Select inspector...</option>
                    {HR_EMPLOYEES.map((emp) => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Item QA Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Items to Inspect ({qaItems.length})
                  </span>
                </div>

                <div className="space-y-3">
                  {qaItems.map((qaItem, idx) => {
                    const checksList = getQaChecks(qaItem);
                    const allChecked = checksList.every((c) => qaItem.checks[c.id]);
                    const isExpanded = !!expandedQaItems[qaItem.inspectionItemId];
                    const accNum = Number(qaItem.acceptedQuantity || 0);
                    const rejNum = Number(qaItem.rejectedQuantity || 0);

                    return (
                      <div
                        key={qaItem.inspectionItemId}
                        className="rounded-2xl border border-border bg-card overflow-hidden transition-colors shadow-xs"
                      >
                        {/* Item Accordion Header */}
                        <div
                          onClick={() => toggleExpandQaItem(qaItem.inspectionItemId)}
                          className="flex items-center justify-between p-3.5 bg-muted/60 dark:bg-muted/40 text-foreground border-b border-border/80 cursor-pointer hover:bg-muted/80 dark:hover:bg-muted/60 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-sm text-foreground">{qaItem.itemName}</span>
                            <span className="rounded-md bg-card border border-border text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">
                              {qaItem.categoryName || "Raw Material"}
                            </span>
                            {(qaItem.totalBatches || 1) > 1 && (
                              <span className="rounded-md bg-card border border-border text-foreground px-2 py-0.5 text-[10px] font-mono font-medium">
                                Batch #{qaItem.batchNumber || 1} of {qaItem.totalBatches}
                              </span>
                            )}
                            {qaItem.expiryDate && (
                              <span className="rounded-md bg-card border border-border text-foreground px-2 py-0.5 text-[10px] font-mono font-medium">
                                Exp: {qaItem.expiryDate}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-xs text-muted-foreground">
                              Received: <strong className="text-foreground font-mono">{qaItem.deliveredQuantity}</strong>
                            </div>
                            {typeof qaItem.acceptedQuantity === "number" && (
                              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                Good: {qaItem.acceptedQuantity}
                              </div>
                            )}
                            {rejNum > 0 && (
                              <div className="text-xs text-rose-600 dark:text-rose-400 font-bold font-mono">
                                Bad: {qaItem.rejectedQuantity}
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Item QA Body — Mirroring Production & Quality layout */}
                        {isExpanded && (
                          <div className="p-4 space-y-4 border-t border-border/60">
                            {/* 1. Accepted (Good) & Rejected (Bad) Quantities + Conditional Reason Dropdowns */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Accepted (Good) Box */}
                              <div className="space-y-2 p-3 rounded-xl border border-border bg-card">
                                <label className="text-xs font-bold text-foreground block">
                                  Accepted / Good (units) <span className="text-destructive">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={qaItem.deliveredQuantity}
                                  value={qaItem.acceptedQuantity}
                                  onChange={(e) => handleSetAccepted(idx, e.target.value)}
                                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                                />

                                {accNum > 0 && (
                                  <div className="space-y-1 pt-1 animate-in fade-in">
                                    <label className="text-[11px] text-muted-foreground block">
                                      Acceptance Reason <span className="text-destructive">*</span>
                                    </label>
                                    <select
                                      value={qaItem.acceptedReason}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setQaItems((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], acceptedReason: val };
                                          return c;
                                        });
                                      }}
                                      className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                                    >
                                      {acceptanceReasons.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>

                              {/* Rejected (Bad) Box */}
                              <div className="space-y-2 p-3 rounded-xl border border-border bg-card">
                                <label className="text-xs font-bold text-foreground block">
                                  Rejected / Bad (units) <span className="text-destructive">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={qaItem.deliveredQuantity}
                                  value={qaItem.rejectedQuantity}
                                  onChange={(e) => handleSetRejected(idx, e.target.value)}
                                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono font-bold text-destructive focus:outline-none focus:ring-1 focus:ring-foreground"
                                />

                                {rejNum > 0 && (
                                  <div className="space-y-1 pt-1 animate-in fade-in">
                                    <label className="text-[11px] text-muted-foreground block">
                                      Rejection Reason <span className="text-destructive">*</span>
                                    </label>
                                    <select
                                      value={qaItem.defectReason}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setQaItems((prev) => {
                                          const c = [...prev];
                                          c[idx] = { ...c[idx], defectReason: val };
                                          return c;
                                        });
                                      }}
                                      className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                                    >
                                      <option value="">Select defect reason</option>
                                      {defectReasons.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="text-[10px] text-destructive pt-1">
                                      Notice: Rejected units will automatically log a Discrepancy record for resolution.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 2. Retained Quality Inspection Checklist */}
                            <div className="p-3 rounded-xl border border-border bg-card space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Quality Inspection Checklist
                                </p>
                                <button
                                  type="button"
                                  onClick={() => toggleCheckAll(idx)}
                                  className="text-[11px] font-semibold text-foreground hover:underline cursor-pointer"
                                >
                                  {allChecked ? "Uncheck All" : "Check All"}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {checksList.map((check) => (
                                  <label
                                    key={check.id}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!qaItem.checks[check.id]}
                                      onChange={() => toggleQaCheck(idx, check.id)}
                                      className="rounded border-border accent-foreground"
                                    />
                                    <span className="text-foreground">{check.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* 3. Optional Item Remarks */}
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-foreground block">
                                Item Remarks (Optional)
                              </label>
                              <input
                                type="text"
                                value={qaItem.notes}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQaItems((prev) => {
                                    const c = [...prev];
                                    c[idx] = { ...c[idx], notes: val };
                                    return c;
                                  });
                                }}
                                placeholder="Add sensory findings, packaging observations, or batch notes..."
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overall Remarks */}
              <div className="pt-1 space-y-1.5">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-foreground">Overall Remarks (Optional)</span>
                  <textarea
                    value={qaOverallNotes}
                    onChange={(e) => setQaOverallNotes(e.target.value)}
                    rows={2}
                    placeholder="Add general quality observations or inspection summary..."
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </label>
              </div>

              {/* Step 2 Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Back to Receiving Counts
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!isQaDone || submitting}
                    onClick={handleExportGrnReport}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Export Goods Receipt Note
                  </button>
                  <button
                    type="button"
                    disabled={!isQaDone || submitting}
                    onClick={() => setConfirmFinishGrnOpen(true)}
                    className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                  >
                    {submitting ? "Finishing…" : "Confirm & Sign Off QA Review"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </ModalWrapper>

      {/* Reject Entire Shipment Modal (Nested Radix Dialog — properly interactive inside ModalWrapper) */}
      <NestedDialog
        open={showRejectModal}
        title="Reject Entire Shipment"
        onClose={() => setShowRejectModal(false)}
        maxWidth={440}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">
            Reject Entire Shipment
          </h2>

          <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
            Delivery No: {selected?.deliveryNumber || "—"}
          </p>

          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Are you sure you want to reject this entire shipment? This will mark the Goods Receipt Note as Rejected and automatically log Discrepancy records for every line item.
          </p>

          <div className="w-full text-left space-y-1.5 mb-4">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-xl border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="">Select Reason</option>
              <option value="Severe transit damage to cargo">Severe transit damage to cargo</option>
              <option value="Packaging compromised / contaminated">Packaging compromised / contaminated</option>
              <option value="Wrong products delivered altogether">Wrong products delivered altogether</option>
              <option value="Delivery documentation completely missing">Delivery documentation completely missing</option>
              <option value="Temperature compliance breached">Temperature compliance breached</option>
              <option value="Expired products on arrival">Expired products on arrival</option>
              <option value="Rejected by commissary gate supervisor">Rejected by commissary gate supervisor</option>
            </select>
          </div>

          <div className="w-full text-left space-y-1.5 mb-5">
            <label className="text-xs font-semibold text-foreground">
              Additional Remarks
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes or photos reference..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
            />
          </div>

          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              disabled={submitting}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!rejectionReason.trim() || submitting}
              onClick={handleRejectShipment}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {submitting ? "Rejecting…" : "Confirm Rejection"}
            </button>
          </div>
        </div>
      </NestedDialog>

      {/* Confirmation before Finish GRN (Nested Radix Dialog) */}
      <NestedDialog
        open={confirmFinishGrnOpen}
        title="Confirm Quality Assurance Review"
        onClose={() => setConfirmFinishGrnOpen(false)}
        maxWidth={480}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Confirm Quality Assurance Review
              </h3>
              <p className="text-xs text-muted-foreground">
                You are about to sign off QA and finalize this Goods Receipt Note.
              </p>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 space-y-2 border border-border text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Goods Receipt Note #:</span>
              <span className="font-mono font-bold text-foreground">
                {activeGrn?.grnNumber || previewGrnNo || "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Accepted (Good):</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {qaItems.reduce((s, i) => s + Number(i.acceptedQuantity || 0), 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Rejected (Bad):</span>
              <span className="font-mono font-semibold text-destructive">
                {qaItems.reduce((s, i) => s + Number(i.rejectedQuantity || 0), 0)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setConfirmFinishGrnOpen(false)}
              disabled={submitting}
              className="rounded-xl border border-border bg-card px-5 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={executeFinishGrn}
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Signing Off..." : "Sign Off & Complete"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </>
  );
}
