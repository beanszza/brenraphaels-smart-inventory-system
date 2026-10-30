// The Module's DTOs are kept as the route handlers returned them so the screens are unchanged.
// Numbers replace Prisma Decimals here; dates survive because results are JSON round-tripped.
import type { Prisma } from "@prisma/client";

const STAFF_NAME_MAP: Record<string, string> = {
  "2026-VM-007": "Vince Neil Madeja",
  "2026-ADMIN-001": "Jude Nitram",
  "2026-JP-008": "Jo Ann Paglicawan",
  "2026-BD-009": "Bianca Dela Peña",
};

export function resolveStaffName(usernameOrName: string | null | undefined): string {
  if (!usernameOrName) return "";
  const trimmed = usernameOrName.trim();
  return STAFF_NAME_MAP[trimmed] || trimmed;
}

export const PR_INCLUDE = {
  PurchaseRequisitionItems: {
    include: {
      Items: {
        include: {
          Inventories: true,
          UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true,
        },
      },
      SuggestedSuppliers: true,
      UnitOfMeasures: true,
    },
  },
} satisfies Prisma.PurchaseRequisitionsInclude;

export const PO_INCLUDE = {
  Suppliers: true,
  PurchaseRequisition: true,
  PurchaseOrderItems: {
    include: { Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }, UnitOfMeasures: true },
  },
} satisfies Prisma.PurchaseOrdersInclude;

export const DELIVERY_INCLUDE = {
  PurchaseOrders: { include: { Suppliers: true } },
  DeliveryItems: {
    include: {
      Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } },
      UnitOfMeasures: true,
      PurchaseOrderItems: true,
    },
  },
} satisfies Prisma.DeliveriesInclude;

type PR = Prisma.PurchaseRequisitionsGetPayload<{ include: typeof PR_INCLUDE }>;

/** `labelled` is the list/detail form: readable status and the stock on hand per line. */
export function prDto(pr: PR, labelled = false) {
  return {
    prId: pr.PrId,
    prNumber: pr.PrNumber,
    department: pr.Department,
    requestedBy: resolveStaffName(pr.RequestedBy),
    requestDate: pr.RequestDate,
    requiredDate: pr.RequiredDate,
    status: labelled
      ? pr.Status === "PendingApproval" ? "Pending Approval" : pr.Status === "ConvertedToPO" ? "Converted to PO" : pr.Status
      : pr.Status,
    requestType: pr.RequestType,
    priority: pr.Priority,
    purpose: pr.Purpose,
    notes: pr.Notes,
    adminNotes: pr.AdminNotes,
    estimatedTotalAmount: Number(pr.EstimatedTotalAmount),
    updatedAt: pr.UpdatedAt,
    items: pr.PurchaseRequisitionItems.map((i) => {
      const uom =
        i.UnitOfMeasures?.Abbreviation ||
        i.UnitOfMeasures?.Name ||
        i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation ||
        "Unit";
      const actualInventory =
        i.Items?.Inventories?.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0) || 0;
      return {
        prItemId: i.PrItemId,
        itemId: i.ItemId,
        itemName: i.Items?.ItemName || "",
        itemCode: i.Items?.ItemCode || `SPL-${String(i.ItemId).padStart(4, "0")}`,
        uomName: uom,
        actualInventory: actualInventory,
        suggestedSupplierId: i.SuggestedSupplierId,
        suggestedSupplierName: i.SuggestedSuppliers?.CompanyName || "",
        requestedQuantity: Number(i.RequestedQuantity),
        purchaseUomId: i.PurchaseUomId,
        purchaseUomAbbreviation: i.UnitOfMeasures?.Abbreviation || uom,
        estimatedUnitPrice: Number(i.EstimatedUnitPrice),
        totalEstimatedValue: Number(i.RequestedQuantity) * Number(i.EstimatedUnitPrice),
        ...(labelled
          ? { currentStockInfo: `${actualInventory} available` }
          : {}),
      };
    }),
  };
}

function parseApprovalMetadata(notes: string | null | undefined) {
  if (!notes) return { supplierApprovedBy: undefined, supplierApprovedDate: undefined, cleanNotes: "" };
  try {
    if (notes.startsWith("{") && notes.endsWith("}")) {
      const parsed = JSON.parse(notes);
      return {
        supplierApprovedBy: parsed.supplierApprovedBy,
        supplierApprovedDate: parsed.supplierApprovedDate,
        cleanNotes: parsed.notes || "",
      };
    }
  } catch {}
  const match = notes.match(/Approved by:\s*(.*?)\s*on\s*([\d\-\/]+)/i);
  if (match) {
    return {
      supplierApprovedBy: match[1]?.trim(),
      supplierApprovedDate: match[2]?.trim(),
      cleanNotes: notes,
    };
  }
  return { supplierApprovedBy: undefined, supplierApprovedDate: undefined, cleanNotes: notes };
}

type PO = Prisma.PurchaseOrdersGetPayload<{ include: typeof PO_INCLUDE }>;

export function poDto(po: PO) {
  const approval = parseApprovalMetadata(po.AdminNotes);
  return {
    poId: po.PoId,
    prId: po.PrId,
    prNumber: po.PurchaseRequisition?.PrNumber,
    supplierId: po.SupplierId,
    supplierName: po.Suppliers?.CompanyName || "",
    supplierAddress: po.Suppliers?.Address || "",
    supplierEmail: po.Suppliers?.Email || "",
    supplierContactPerson: po.Suppliers?.ContactPerson || "",
    supplierPhone: po.Suppliers?.Phone || "",
    supplierApprovedBy: approval.supplierApprovedBy,
    supplierApprovedDate: approval.supplierApprovedDate,
    orderDate: po.OrderDate,
    poNumber: po.PoNumber,
    expectedArrivalDate: po.ExpectedArrivalDate,
    status: po.Status,
    paymentType: po.PaymentType,
    totalAmount: Number(po.TotalAmount),
    requestedBy: resolveStaffName(po.RequestedBy),
    adminNotes: approval.cleanNotes || po.AdminNotes,
    qaNotes: po.QaNotes,
    qaInspectedDate: po.QaInspectedDate,
    qaStatus: po.QaStatus,
    inspectedBy: po.InspectedBy,
    items: po.PurchaseOrderItems.map((i) => {
      const qty = Number(i.PoItemQuantity);
      const total = Number(i.TotalPrice);
      const unit = qty > 0 ? total / qty : 0;
      return {
        poItemId: i.PoItemId,
        itemId: i.ItemId,
        itemCode: i.Items?.ItemCode || `SPL-${String(i.ItemId).padStart(4, "0")}`,
        itemName: i.Items?.ItemName || "",
        poItemQuantity: qty,
        receivedQuantity: Number(i.ReceivedQuantity),
        totalPrice: total,
        unitPrice: unit,
        purchaseUomId: i.PurchaseUomId,
        purchaseUomName:
          i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
      };
    }),
  };
}

type Delivery = Prisma.DeliveriesGetPayload<{ include: typeof DELIVERY_INCLUDE }>;

export function deliveryDto(d: Delivery) {
  return {
    deliveryId: d.DeliveryId,
    deliveryNumber: d.DeliveryNumber,
    poId: d.PoId,
    poNumber: d.PurchaseOrders?.PoNumber,
    supplierId: d.SupplierId,
    supplierName: d.PurchaseOrders?.Suppliers?.CompanyName || "",
    receivingLocationId: d.ReceivingLocationId,
    receivingLocationName: "Commissary (Receiving Bay)",
    status: d.Status,
    scheduledDate: d.ScheduledDate,
    dispatchedDate: d.DispatchedDate,
    expectedArrivalDate: d.ExpectedArrivalDate,
    actualArrivalDate: d.ActualArrivalDate,
    trackingNumber: d.TrackingNumber,
    carrier: d.Carrier,
    driverName: d.DriverName,
    vehiclePlateNumber: d.VehiclePlateNumber,
    deliveryNoteNumber: d.DeliveryNoteNumber,
    paymentType: d.PaymentType,
    notes: d.Notes,
    attachmentUrl: d.AttachmentUrl,
    scheduledAttachment: d.ScheduledAttachment || d.AttachmentUrl,
    arrivalAttachment: d.ArrivalAttachment,
    createdBy: resolveStaffName(d.CreatedBy),
    receivedBy: resolveStaffName(d.ReceivedBy),
    createdAt: d.CreatedAt,
    items: d.DeliveryItems.map((i) => ({
      deliveryItemId: i.DeliveryItemId,
      poItemId: i.PoItemId,
      itemId: i.ItemId,
      itemCode: i.Items?.ItemCode || `SPL-${String(i.ItemId).padStart(4, "0")}`,
      itemName: i.Items?.ItemName || "",
      poOrderedQuantity: Number(i.PurchaseOrderItems?.PoItemQuantity || i.DeclaredQuantity || 0),
      poTotalReceivedQuantity: Number(i.PurchaseOrderItems?.ReceivedQuantity || 0),
      poOutstandingQuantity: Math.max(
        0,
        Number(i.PurchaseOrderItems?.PoItemQuantity || 0) - Number(i.PurchaseOrderItems?.ReceivedQuantity || 0)
      ),
      declaredQuantity: Number(i.DeclaredQuantity),
      purchaseUomId: i.PurchaseUomId,
      purchaseUomName:
        i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
    })),
  };
}
