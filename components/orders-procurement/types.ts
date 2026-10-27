export type OrderStatus = "Pending" | "Arrived" | "Completed" | "Cancelled" | "Rejected";
export type PaymentType = "Payable" | "Paid";

export type Order = {
  id: string;
  poId: number;
  item: string;
  itemId: number;
  category: string;
  supplier: string;
  supplierId: number;
  quantity: number;
  orderDate: string;
  eta: string;
  status: OrderStatus;
  payment: PaymentType;
  arrivalDate?: string;
  qaInspected?: string;
  qaStatus?: string;
  inspectedBy?: string;
  received?: number;
  qaApproved?: number;
  qaNotes?: string;
  unit: string;
  proofImageUrl?: string;
};

export type SupplyItem = {
  itemId: number;
  itemName: string;
  categoryName: string;
  uomName?: string;
};

export type Supplier = {
  supplierId: number;
  companyName: string;
};

export type PRStatus =
  | "Draft"
  | "Pending Approval"
  | "Returned"
  | "Approved"
  | "Rejected"
  | "Converted to PO"
  | "Cancelled"
  | "Closed";

export type PRItem = {
  prItemId?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  uomName: string;
  purchaseUomId?: number;
  actualInventory: number;
  requestedQuantity: number;
  estimatedUnitPrice?: number;
};

export type PurchaseRequisition = {
  prId: number;
  prNumber: string;
  department: string;
  requestedBy: string;
  requestDate: string;
  requiredDate: string;
  status: PRStatus;
  requestType: string;
  priority: string;
  purpose: string;
  notes?: string;
  adminNotes?: string;
  estimatedTotalAmount?: number;
  generatedPoNumbers?: string;
  updatedAt?: string;
  items: PRItem[];
};

// ─── Purchase Order Types ───────────────────────────────────────────────────

export type POStatus =
  | "Draft"
  | "Pending Approval"
  | "Returned"
  | "Approved"
  | "Partially Delivered"
  | "Delivered"
  | "Ordered"
  | "Rejected"
  | "Cancelled"
  | "Pending"    // legacy
  | "Arrived"    // legacy
  | "Completed"; // legacy

export type POItem = {
  poItemId?: number;
  itemId: number;
  itemCode?: string;
  itemName: string;
  poItemQuantity: number;
  receivedQuantity?: number;
  /** Total price for this line, generated from supplier unit price × ordered quantity. */
  totalPrice: number;
  /** Supplier catalog unit price used for this order. */
  unitPrice: number;
  purchaseUomId?: number;
  purchaseUomName: string;
  lineTotal: number;
};

export type PurchaseOrderPO = {
  poId: number;
  poNumber: string;
  prId?: number;
  prNumber?: string;
  supplierId: number;
  supplierName: string;
  requestedBy: string;
  orderDate: string;
  expectedArrivalDate: string;
  status: POStatus;
  paymentType?: string;
  adminNotes?: string;
  totalAmount: number;
  items: POItem[];
};

// ─── Delivery Types ─────────────────────────────────────────────────────────

export type DeliveryStatus = "Scheduled" | "In Transit" | "Arrived" | "Cancelled";

export type DeliveryItem = {
  deliveryItemId?: number;
  poItemId: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  poOrderedQuantity: number;
  poTotalReceivedQuantity: number;
  poOutstandingQuantity: number;
  alreadyScheduledQuantity?: number;
  declaredQuantity: number;
  purchaseUomId: number;
  purchaseUomName: string;
};

export type Delivery = {
  deliveryId: number;
  deliveryNumber: string;
  poId: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  paymentType?: string;
  receivingLocationId: number;
  receivingLocationName: string;
  status: DeliveryStatus;
  scheduledDate: string;
  expectedArrivalDate?: string;
  dispatchedDate?: string;
  actualArrivalDate?: string;
  trackingNumber?: string;
  carrier?: string;
  driverName?: string;
  vehiclePlateNumber?: string;
  deliveryNoteNumber?: string;
  arrivalCondition?: string;
  arrivalNotes?: string;
  isPerBatch?: boolean;
  batchReference?: string;
  notes?: string;
  attachmentUrl?: string;
  scheduledAttachment?: string;
  dispatchAttachment?: string;
  arrivalAttachment?: string;
  createdBy: string;
  dispatchedBy?: string;
  receivedBy?: string;
  createdAt: string;
  grnId?: number;
  grnNumber?: string;
  items: DeliveryItem[];
};

