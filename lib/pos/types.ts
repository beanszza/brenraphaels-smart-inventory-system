export interface PosVariationDto {
  sku: string;
  variationName: string;
  packagingType: string;
  size: string;
  isActive: boolean;
  price?: number;
}

export interface SyncProductDto {
  scmsProductId: string;
  productName: string;
  productCategory: string;
  productDescription?: string;
  productImage?: string;
  isActive: boolean;
  variations: PosVariationDto[];
}

export interface SyncProductResponse {
  success: boolean;
  message: string;
  data?: {
    productId?: number;
    scmsProductId?: string;
    syncedVariationsCount?: number;
    pendingPricingCount?: number;
  };
}

export interface PosBranchLocationDto {
  locationId: number;
  locationName: string;
  locationType?: string;
  address?: string;
  isActive?: boolean;
}

export interface PosTransferManifestDto {
  transferId: string;
  stockRequestId?: string;
  sourceLocation: {
    locationId: string;
    locationName: string;
  };
  destinationLocation: {
    branchId: string;
    branchName: string;
  };
  transferDate: string;
  status: string;
  products: {
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    batchNumber?: string;
    expirationDate?: string;
  }[];
}

export interface PosStockRequestItemDto {
  sku: string;
  productId?: string | null;
  productName: string;
  variationName: string;
  quantity: number;
  currentStock: number;
}

export interface PosStockRequestDto {
  requestId: string;
  branch: {
    branchId: string;
    branchName: string;
  };
  items: PosStockRequestItemDto[];
  notes: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
}

export interface PosStockRequestDecisionDto {
  status: "Approved" | "Rejected";
  approvedQuantity?: number;
  remarks?: string;
  imsRequestId?: string;
  decidedBy: string;
  decidedByName: string;
  decidedAt: string;
}
