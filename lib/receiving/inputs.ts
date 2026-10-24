export type NotesInput = { notes?: string; reason?: string };
export type ReceiptLine = {
  itemId: number; deliveryItemId?: number; poItemId?: number;
  deliveredQuantity?: number; actualReceivedQuantity?: number;
  supplierLotCode?: string; manufactureDate?: string; expiryDate?: string; notes?: string;
};
export type ReceiptInput = NotesInput & {
  deliveryId?: number; items?: ReceiptLine[]; deliveryNoteNumber?: string;
  supplierDrNumber?: string; supplierInvoiceNumber?: string; receivingBay?: string; carrier?: string;
};
export type InspectionInput = {
  overallNotes?: string;
  items?: { inspectionItemId: number; acceptedQuantity?: number; rejectedQuantity?: number;
    concessionQuantity?: number; defectReason?: string; notes?: string }[];
};
export type ResolutionInput = NotesInput & { resolutionType?: string; resolutionNotes?: string; carrier?: string };
export type ReturnInput = NotesInput & { dispatchDate?: string; creditNoteNumber?: string };
export type StockInInput = NotesInput & {
  grnId: number; submitForApproval?: boolean;
  lines: { grnItemId?: number; itemId: number; purchaseUomId?: number; quantityToStock: number;
    currentStockBeforeCommit?: number; lotCode: string; expiryDate?: string; notes?: string }[];
};
