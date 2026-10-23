export type FinishedProductVariant = {
  productId: number;
  variant: string;
  sku: string;
  currentStock?: number;
  reservedStock?: number;
};

export type InventoryItem = {
  inventoryId: number | string;
  itemId: number;
  itemCode?: string;
  itemName: string;
  variantName?: string;
  variantSku?: string;
  productId?: number;
  categoryId?: number;
  categoryName: string;
  uomName: string;
  uomAbbreviation?: string;
  locationId: number;
  locationName: string;
  currentStock: number;
  reservedStock?: number;
  availableStock?: number;
  minStockLevel: number;
  maxStockLevel: number;
  isLowStock: boolean;
  isOverStock?: boolean;
  isActive?: boolean;
  isLotTracked?: boolean;
  isExpiryTracked?: boolean;
  /** Populated for Finished Goods items — each variant (e.g. "250g Jar", "500g Tub") is a separate FinishedProduct record */
  finishedProductVariants?: FinishedProductVariant[];
};
