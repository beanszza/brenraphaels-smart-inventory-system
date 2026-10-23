// The Module's DTOs are kept as the route handlers returned them so the screens are unchanged.
// Numbers replace Prisma Decimals here; dates survive because results are JSON round-tripped.
import type { Prisma } from "@prisma/client";

export const PR_INCLUDE = {
  PurchaseRequisitionItems: {
    include: { Items: { include: { Inventories: true } }, SuggestedSuppliers: true, UnitOfMeasures: true },
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
    requestedBy: pr.RequestedBy,
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
    items: pr.PurchaseRequisitionItems.map((i) => ({
      prItemId: i.PrItemId,
      itemId: i.ItemId,
      itemName: i.Items?.ItemName || "",
      suggestedSupplierId: i.SuggestedSupplierId,
      suggestedSupplierName: i.SuggestedSuppliers?.CompanyName || "",
      requestedQuantity: Number(i.RequestedQuantity),
      purchaseUomId: i.PurchaseUomId,
      purchaseUomAbbreviation: i.UnitOfMeasures?.Abbreviation || "",
      estimatedUnitPrice: Number(i.EstimatedUnitPrice),
      totalEstimatedValue: Number(i.RequestedQuantity) * Number(i.EstimatedUnitPrice),
      ...(labelled
        ? { currentStockInfo: `${i.Items?.Inventories?.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0) || 0} available` }
        : {}),
    })),
  };
}

type PO = Prisma.PurchaseOrdersGetPayload<{ include: typeof PO_INCLUDE }>;

export function poDto(po: PO) {
  return {
    poId: po.PoId,
    prId: po.PrId,
    prNumber: po.PurchaseRequisition?.PrNumber,
    supplierId: po.SupplierId,
    supplierName: po.Suppliers?.CompanyName || "",
    orderDate: po.OrderDate,
    poNumber: po.PoNumber,
    expectedArrivalDate: po.ExpectedArrivalDate,
    status: po.Status,
    paymentType: po.PaymentType,
    totalAmount: Number(po.TotalAmount),
    requestedBy: po.RequestedBy,
    adminNotes: po.AdminNotes,
    qaNotes: po.QaNotes,
    qaInspectedDate: po.QaInspectedDate,
    qaStatus: po.QaStatus,
    inspectedBy: po.InspectedBy,
    items: po.PurchaseOrderItems.map((i) => ({
      poItemId: i.PoItemId,
      itemId: i.ItemId,
      itemName: i.Items?.ItemName || "",
      poItemQuantity: Number(i.PoItemQuantity),
      receivedQuantity: Number(i.ReceivedQuantity),
      totalPrice: Number(i.TotalPrice),
      purchaseUomId: i.PurchaseUomId,
      purchaseUomName:
        i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
    })),
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
    createdAt: d.CreatedAt,
    items: d.DeliveryItems.map((i) => ({
      deliveryItemId: i.DeliveryItemId,
      poItemId: i.PoItemId,
      itemId: i.ItemId,
      itemName: i.Items?.ItemName || "",
      declaredQuantity: Number(i.DeclaredQuantity),
      purchaseUomId: i.PurchaseUomId,
      purchaseUomName:
        i.UnitOfMeasures?.Abbreviation || i.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
    })),
  };
}
