/** Must be deployed in the Audit Logs IMS catalog before this producer ships. */
export const IMS_ACTIONS = [
  "record.created", "record.updated", "record.deleted", "record.viewed",
  "purchase_requisition.submitted", "purchase_requisition.approved", "purchase_requisition.rejected",
  "purchase_order.created", "purchase_order.approved", "purchase_order.rejected",
  "delivery.received", "delivery.discrepancy_logged", "goods_receipt.inspected",
  "return_to_vendor.submitted", "return_to_vendor.approved", "return_to_vendor.rejected",
  "stock_in.approved", "stock_in.rejected", "stock_in.put_away", "cycle_count.reconciled",
  "loss_report.submitted", "loss_report.approved", "loss_report.rejected", "lot.recalled",
  "production_request.submitted", "production_request.approved", "production_request.rejected",
  "material.issued", "production_batch.stage_changed", "production_batch.qa_approved", "production_batch.qa_rejected",
  "stock_transfer.requested", "stock_transfer.approved", "stock_transfer.rejected",
  "stock_transfer.dispatched", "stock_transfer.received", "ims.signed_in", "ims.access_denied",
] as const;

export type ImsAuditAction = typeof IMS_ACTIONS[number];

export function auditActionLabel(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
