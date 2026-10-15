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
  status: string;
  transferQuantity: number;
  scheduledDate: string | null;
  dispatchedDate: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  courierName?: string | null;
}

export interface StockTransferRequest {
  requestId: number;
  requestNumber: string;
  toLocationId: number;
  toLocationName: string;
  requestedBy: string;
  requestDate: string;
  requiredDate: string;
  priority: "Normal" | "High" | "Urgent" | string;
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
