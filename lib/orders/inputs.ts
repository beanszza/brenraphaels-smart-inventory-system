export type RequisitionLine = {
  itemId: number;
  suggestedSupplierId?: number | null;
  requestedQuantity: number;
  purchaseUomId: number;
  estimatedUnitPrice?: number;
};

export type RequisitionInput = {
  requestedBy?: string | null;
  department?: string | null;
  requiredDate?: string | null;
  requestType?: string | null;
  priority?: string | null;
  purpose?: string | null;
  notes?: string | null;
  submitForApproval?: boolean;
  items: RequisitionLine[];
};

export type StatusInput = {
  status?: string | null;
  adminNotes?: string | null;
  comments?: string | null;
  qaStatus?: string | null;
  qaNotes?: string | null;
};

export type OrderInput = {
  supplierId: number | null;
  prId?: number | null;
  expectedArrivalDate?: string | null;
  paymentType?: string | null;
  initialStatus?: string | null;
  items: { itemId: number; poItemQuantity: number; purchaseUomId?: number | null }[];
};

export type DeliveryInput = {
  poId: number | null;
  scheduledDate?: string | null;
  expectedArrivalDate?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  driverName?: string | null;
  vehiclePlateNumber?: string | null;
  deliveryNoteNumber?: string | null;
  paymentType?: string | null;
  notes?: string | null;
  attachmentUrl?: string | null;
  items: { poItemId: number; declaredQuantity: number }[];
};

export type DeliveryUpdateInput = {
  reason?: string | null;
  dispatchedDate?: string | null;
  actualArrivalDate?: string | null;
  expectedArrivalDate?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  driverName?: string | null;
  vehiclePlateNumber?: string | null;
  deliveryNoteNumber?: string | null;
  notes?: string | null;
};

export type MrpInput = { plannedBatches?: { recipeId: number; batchCount: number }[] };

export type ApproveOrderLine = {
  itemId: number;
  poItemQuantity: number;
  unitPrice: number;
  totalPrice?: number;
};

export type ApproveOrderInput = {
  confirmedItems: ApproveOrderLine[];
  supplierApprovedBy: string;
  supplierApprovedDate?: string;
  notes?: string;
  expectedArrivalDate?: string;
};
