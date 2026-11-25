export type STRStatus =
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Scheduled"
  | "Dispatched"
  | "Cancelled";

export type STFStatus =
  | "Pending"
  | "Scheduled"
  | "Dispatched"
  | "In Transit"
  | "Completed"
  | "Cancelled";

export interface SuggestedLotAllocation {
  lotId: number;
  lotCode: string;
  expiryDate: string | null;
  qty: number;
}

export interface STRItem {
  requestItemId?: number;
  productId: number;
  productName: string;
  variant: string;
  sku: string;
  requestedQuantity: number;
  availableQuantity: number;
  isInsufficient?: boolean;
  suggestedLots?: SuggestedLotAllocation[] | null;
  notes?: string;
}

export interface STRTransferRef {
  transferId: number;
  transferNumber: string;
  productId?: number;
  status: string;
  transferQuantity: number;
  scheduledDate: string | null;
  dispatchedDate: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  courierName?: string | null;
  proofOfReceipt?: string | null;
  notes?: string | null;
}

export interface StockTransferRequest {
  requestId: number;
  requestNumber: string;
  branchRequestId?: number | null;
  branchRequestNumber?: string | null;
  toLocationId: number;
  toLocationName: string;
  requestedBy: string;
  requestDate: string;
  requiredDate: string;
  priority: "Low" | "Medium" | "High" | "Normal" | "Urgent" | string;
  reason: string;
  status: STRStatus | string;
  adminNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  items: STRItem[];
  transfers?: STRTransferRef[];
}

export interface StockTransfer {
  transferId: number;
  transferNumber: string;
  requestId: number | null;
  requestNumber: string | null;
  productId: number;
  productName: string;
  variant: string;
  sku: string;
  sourceLocationId: number;
  sourceLocationName: string;
  destLocationId: number;
  destLocationName: string;
  transferQuantity: number;
  status: STFStatus | string;
  scheduledDate: string | null;
  transferDate: string | null;
  dispatchedDate: string | null;
  receivedDate: string | null;
  driverName: string;
  vehiclePlate: string;
  courierName: string;
  proofOfReceipt: string;
  priority: string;
  notes: string;
  receivedBy: string;
  createdAt: string | null;
}

export interface FinishedProductOption {
  productId: number;
  itemId: number;
  itemName: string;
  variant: string;
  sku: string;
  sellingPrice: number;
}

export interface LocationOption {
  locationId: number;
  locationName: string;
  locationType: string;
  isSystemLocation: boolean;
}

export interface DashboardMetrics {
  totalRequests: number;
  pendingApproval: number;
  approvedRequests: number;
  dispatchedTransfers: number;
  scheduledTransfers: number;
}

export type STRActionType = "approve" | "reject" | "cancel";

export type BranchRequestSubtab = "requests" | "approved" | "rejected" | "cancelled" | "completed";

export interface BranchStockRequestItem {
  branchRequestItemId: number;
  productId: number;
  sku: string;
  productName: string;
  variationName: string;
  branchCurrentStock: number;
  imsAvailableStock: number;
  requestedQuantity: number;
  approvedQuantity: number;
  allocatedQuantity: number;
  remainingQuantity: number;
  scheduledQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
}

export interface BranchLinkedStr {
  requestId: number;
  requestNumber: string;
  status: string;
  quantity: number;
  createdAt: string;
}

export interface BranchStockRequest {
  branchRequestId: number;
  imsRequestId: string;
  requestNumber: string;
  branchId: number;
  branchName: string;
  requestDate: string;
  status: string;
  subtab: BranchRequestSubtab;
  transferStage: "Unscheduled" | "Pending Schedule" | "Scheduled" | "In Transit" | "Delivered";
  requestedBy: string;
  requestedByName: string;
  notes: string;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionRemarks: string;
  cancelledBy?: string | null;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  fulfilledAt: string | null;
  posSyncStatus: string;
  posSyncError: string | null;
  posManifestLinked: boolean;
  totalRequested: number;
  totalApproved: number;
  totalAllocated: number;
  totalRemaining: number;
  totalScheduled: number;
  totalDispatched: number;
  totalReceived: number;
  items: BranchStockRequestItem[];
  linkedStrs: BranchLinkedStr[];
}

export interface CreateSTRPrefill {
  branchRequestId: number;
  branchRequestNumber: string;
  branchId: number;
  branchName: string;
  productId: number;
  productName: string;
  variationName: string;
  sku: string;
  approvedQuantity: number;
  remainingQuantity: number;
}
