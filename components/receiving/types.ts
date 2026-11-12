export interface GRNItem {
  grnItemId: number;
  poItemId: number;
  itemId: number;
  itemName: string;
  categoryName?: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  declaredQuantity?: number;
  deliveredQuantity: number;
  varianceQuantity: number;
  varianceType?: string; // "Short", "Over", "None"
  deliveryItemId?: number;
  purchaseUomId: number;
  purchaseUomName: string;
  lotId?: number;
  lotCode?: string;
  supplierLotCode?: string;
  manufactureDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface GRN {
  grnId: number;
  grnNumber: string;
  poId: number;
  poNumber: string;
  prId?: number;
  prNumber?: string;
  deliveryId?: number;
  deliveryNumber?: string;
  supplierId: number;
  supplierName: string;
  receivingLocationId: number;
  receivingLocationName: string;
  receivedDate: string;
  deliveryNoteNumber: string;
  supplierDrNumber?: string;
  supplierInvoiceNumber?: string;
  receivingBay?: string;
  carrier?: string;
  receivedBy: string;
  createdBy: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  status: string; // "Draft", "Received", "QaPending", "QaCompleted", "PartiallyPutAway", "FullyPutAway", "Cancelled", "Rejected"
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  notes?: string;
  items: GRNItem[];
}

export interface StockInLine {
  stockInLineId: number;
  stockInId: number;
  grnItemId?: number;
  itemId: number;
  itemName: string;
  itemCode?: string;
  categoryName?: string;
  purchaseUomId?: number;
  purchaseUomName: string;
  quantityToStock: number;
  currentStockBeforeCommit: number;
  lotCode: string;
  expiryDate?: string;
  committedToInventory: boolean;
  inventoryLotId?: number;
  notes?: string;
}

export interface StockIn {
  stockInId: number;
  stockInNumber: string;
  grnId: number;
  grnNumber: string;
  supplierId: number;
  supplierName: string;
  poNumber: string;
  status: string; // "Draft", "PendingApproval", "Approved", "Committed", "Rejected"
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  committedBy?: string;
  committedAt?: string;
  notes?: string;
  lines: StockInLine[];
}

export interface QAInspectionItem {
  inspectionItemId: number;
  itemId: number;
  itemName: string;
  categoryName?: string;
  expiryDate?: string;
  lotId?: number;
  lotCode?: string;
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  concessionQuantity: number;
  defectReason?: string;
  notes?: string;
}

export interface QAInspection {
  inspectionId: number;
  inspectionNumber: string;
  inspectionType: string;
  referenceType: string;
  referenceId: number;
  referenceNumber: string;
  poId?: number;
  poNumber?: string;
  prId?: number;
  prNumber?: string;
  supplierName?: string;
  grnNumber?: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: string;
  status: string; // "Pending", "Passed", "PassedWithConcession", "Failed"
  totalReceivedQuantity: number;
  totalAcceptedQuantity: number;
  totalRejectedQuantity: number;
  completedAt?: string;
  completedBy?: string;
  overallNotes?: string;
  items: QAInspectionItem[];
}

export interface Discrepancy {
  discrepancyId: number;
  discrepancyNumber: string;
  discrepancyType: string; // "PartialShort", "OverSupply", "Rejected"
  grnId: number;
  grnNumber: string;
  poId: number;
  poNumber: string;
  prId?: number;
  prNumber?: string;
  supplierName?: string;
  deliveryId?: number;
  deliveryNumber?: string;
  itemId: number;
  itemName: string;
  orderedQuantity: number;
  previouslyReceivedQty: number;
  currentReceivedQty: number;
  discrepancyQuantity: number;
  status: string; // "Open", "InReview", "Resolved", "Closed"
  resolutionType?: string; // "NewDelivery", "CloseRemaining", "LossReport", "ReturnToSupplier", "KeepWithCredit"
  resolutionNotes?: string;
  lossReportId?: number;
  lossReportNumber?: string;
  rtvId?: number;
  rtvNumber?: string;
  ncrId?: number;
  ncrNumber?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface LossReport {
  lossReportId: number;
  lossReportNumber: string;
  discrepancyId?: number;
  discrepancyNumber?: string;
  grnId?: number;
  grnNumber?: string;
  poId?: number;
  poNumber?: string;
  prId?: number;
  prNumber?: string;
  supplierName?: string;
  itemId: number;
  itemName: string;
  itemCode?: string;
  lostQuantity: number;
  uomId?: number;
  uomName?: string;
  unitCost?: number;
  totalCost?: number;
  reason: string;
  notes?: string;
  isAcknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  authorisedBy: string;
  createdBy: string;
  createdAt: string;
  stockLedgerEntryId?: number;
}

export interface PutAwayTask {
  putAwayId: number;
  putAwayNumber: string;
  grnId: number;
  grnNumber: string;
  grnItemId: number;
  poId?: number;
  poNumber?: string;
  prId?: number;
  prNumber?: string;
  supplierName?: string;
  qaInspectionId?: number;
  itemId: number;
  itemName: string;
  acceptedQuantity: number;
  uomId: number;
  uomName: string;
  destinationLocationId?: number;
  destinationLocationName?: string;
  lotId?: number;
  lotCode?: string;
  expiryDate?: string;
  serialNumber?: string;
  status: string; // "Pending", "Completed", "Cancelled"
  performedBy?: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  isLotTracked: boolean;
  isExpiryTracked: boolean;
}

export interface ArrivedDelivery {
  deliveryId: number;
  deliveryNumber: string;
  poId: number;
  poNumber: string;
  prId?: number;
  prNumber?: string;
  supplierId: number;
  supplierName: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedArrival?: string;
  actualArrival?: string;
  items?: {
    deliveryItemId: number;
    poItemId: number;
    itemId: number;
    itemName: string;
    categoryName?: string;
    categoryHasExpiry?: boolean;
    orderedQuantity: number;
    declaredQuantity: number;
    uomName: string;
  }[];
}

export interface RtvRecord {
  rtvId: number;
  rtvNumber: string;
  ncrId?: number;
  ncrNumber?: string;
  discrepancyId?: number;
  discrepancyNumber?: string;
  grnId?: number;
  grnNumber?: string;
  poId?: number;
  poNumber?: string;
  prId?: number;
  prNumber?: string;
  supplierId: number;
  supplierName: string;
  itemId?: number;
  itemName?: string;
  returnedQuantity?: number;
  quantityReturned?: number;
  uomName?: string;
  returnReason?: string;
  status: string;
  approvalRequestNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  trackingNumber?: string;
  carrier?: string;
  shippedDate?: string;
  createdAt: string;
  createdBy?: string;
  creditNoteNumber?: string;
  notes?: string;
}
