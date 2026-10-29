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
