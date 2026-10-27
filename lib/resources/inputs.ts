export type ItemInput = {
  itemName: string;
  uomId: number;
  categoryId: number;
  minStockLevel: number;
  maxStockLevel: number;
  isActive?: boolean;
};

export type SupplierInput = {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  isActive?: boolean;
  suppliedItemIds?: number[];
};

export type LocationInput = {
  locationName: string;
  locationType?: string;
  status?: string;
  address?: string;
  parentLocationId?: number | null;
  isActive?: boolean;
};

export type SupplierItemInput = {
  supplierId: number;
  itemId: number;
  purchaseUomId: number;
  unitPrice: number;
  supplierSku?: string;
  supplierItemName?: string;
  currency?: string;
  packSize?: number;
  leadTimeDays?: number;
  minOrderQuantity?: number;
  isPreferred?: boolean;
  isActive?: boolean;
};

export type RecipeInput = {
  recipeName: string;
  productId: number;
  outputQuantity?: number;
  notes?: string;
  isActive?: boolean;
  ingredients: { itemId: number; uomId: number; standardQuantity: number }[];
};
