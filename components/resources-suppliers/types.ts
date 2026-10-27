export type SupplyItem = {
  itemId: number;
  itemCode?: string;
  itemName: string;
  categoryId: number;
  categoryName: string;
  uomId: number;
  uomName: string;
  minStockLevel: number;
  maxStockLevel: number;
  currentStock: number;
  isActive: boolean;
  supplierIds?: number[];
};

export type Supplier = {
  supplierId: number;
  supplierCode?: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  isActive: boolean;
  suppliedItems?: { itemId: number; itemName: string }[];
};

export type Ingredient = {
  id: number;
  itemId: number;
  itemName?: string;
  uomId: number;
  quantity: string;
};

export type Recipe = {
  recipeId: number;
  recipeCode?: string;
  recipeName: string;
  displayName?: string;
  yieldLabel?: string;
  finishedProduct: string;
  productId: number;
  outputQuantity: number;
  notes: string;
  isActive: boolean;
  ingredients: { itemId: number; uomId: number; standardQuantity: number }[];
};

export type FinishedProduct = {
  productId: number;
  itemName: string;
  variant?: string;
};

export type CategoryOption = {
  categoryId: number;
  categoryName: string;
};

export type CategoryItem = {
  categoryId: number;
  categoryName: string;
  description: string;
  isActive: boolean;
  itemCount?: number;
};

export type UomOption = {
  uomId: number;
  code: string;
  name: string;
  abbreviation: string;
  uomType: string;
  conversionFactor: number;
};
