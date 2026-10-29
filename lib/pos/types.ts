export interface PosVariationDto {
  sku: string;
  variationName: string;
  packagingType: string;
  size: string;
  isActive: boolean;
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
