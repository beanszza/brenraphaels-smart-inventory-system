export type SwoStatus =
  | "Pending Approval"
  | "Approved"
  | "Removed"
  | "Rejected"
  | "Cancelled";

export interface StockWriteOffPhotoDto {
  photoId: number;
  writeOffItemId: number;
  fileId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface StockWriteOffLineDto {
  lineId: number;
  writeOffItemId: number;
  lotId: number;
  lotCode: string;
  expiryDate: string | null;
  availableBefore: number;
  quantity: number;
  unitCost: number;
  lineValue: number;
  reason: string;
  reasonOther: string | null;
  disposition: string;
  dispositionOther: string | null;
  remarks: string;
  ledgerId: string | null;
}

export interface StockWriteOffItemDto {
  writeOffItemId: number;
  writeOffId: number;
  itemId: number;
  productId: number | null;
  itemType: string;
  itemName: string;
  itemCode: string;
  variantName: string;
  uomId: number;
  uomName: string;
  hasExpiry: boolean;
  lines: StockWriteOffLineDto[];
  photos: StockWriteOffPhotoDto[];
}

export interface StockWriteOffDto {
  writeOffId: number;
  swoNumber: string;
  status: SwoStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  generalRemarks: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledBy: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  removedBy: string | null;
  removedByName: string | null;
  removedAt: string | null;
  totalValue: number;
  updatedAt: string;
  items: StockWriteOffItemDto[];
}

export interface WriteOffFormLotOption {
  lotId: number;
  lotCode: string;
  itemId: number;
  productId: number | null;
  variantName: string;
  expiryDate: string | null;
  quantityRemaining: number;
  reservedQuantity: number;
  pendingWriteOffQuantity: number;
  availableQuantity: number;
  unitCost: number;
  uomId: number;
  uomName: string;
  isExpired: boolean;
}

export interface WriteOffFormItemOption {
  key: string; // e.g. "item:12" or "fg:5"
  itemId: number;
  productId: number | null;
  itemType: string;
  itemName: string;
  itemCode: string;
  variantName: string;
  displayLabel: string;
  uomId: number;
  uomName: string;
  hasExpiry: boolean;
  lots: WriteOffFormLotOption[];
}

export interface WriteOffFormData {
  nextSwoNumberPreview: string;
  itemTypes: Array<{
    name: string;
    hasExpiry: boolean;
  }>;
  items: WriteOffFormItemOption[];
}
