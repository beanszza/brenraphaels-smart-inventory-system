/** IMS producer vocabulary; legacy wire actions support older Audit Logs catalogs. */
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

export type LegacyAuditAction = Extract<ImsAuditAction, `record.${string}`>;

/** Exhaustive so new workflow actions require an explicit compatibility decision. */
const LEGACY_ACTIONS = {
  "record.created": "record.created",
  "record.updated": "record.updated",
  "record.deleted": "record.deleted",
  "record.viewed": "record.viewed",
  "purchase_requisition.submitted": "record.created",
  "purchase_requisition.approved": "record.updated",
  "purchase_requisition.rejected": "record.updated",
  "purchase_order.created": "record.created",
  "purchase_order.approved": "record.updated",
  "purchase_order.rejected": "record.updated",
  "delivery.received": "record.created",
  "delivery.discrepancy_logged": "record.created",
  "goods_receipt.inspected": "record.updated",
  "return_to_vendor.submitted": "record.created",
  "return_to_vendor.approved": "record.updated",
  "return_to_vendor.rejected": "record.updated",
  "stock_in.approved": "record.updated",
  "stock_in.rejected": "record.updated",
  "stock_in.put_away": "record.created",
  "cycle_count.reconciled": "record.updated",
  "loss_report.submitted": "record.created",
  "loss_report.approved": "record.updated",
  "loss_report.rejected": "record.updated",
  "lot.recalled": "record.updated",
  "production_request.submitted": "record.created",
  "production_request.approved": "record.updated",
  "production_request.rejected": "record.updated",
  "material.issued": "record.created",
  "production_batch.stage_changed": "record.updated",
  "production_batch.qa_approved": "record.updated",
  "production_batch.qa_rejected": "record.updated",
  "stock_transfer.requested": "record.created",
  "stock_transfer.approved": "record.updated",
  "stock_transfer.rejected": "record.updated",
  "stock_transfer.dispatched": "record.updated",
  "stock_transfer.received": "record.updated",
  "ims.signed_in": "record.viewed",
  "ims.access_denied": "record.viewed",
} satisfies Record<ImsAuditAction, LegacyAuditAction>;

export function toLegacyAuditAction(action: ImsAuditAction): LegacyAuditAction {
  return LEGACY_ACTIONS[action];
}

export function formatCompatDescription(action: ImsAuditAction, description: string): string {
  return `[${action}] ${description}`;
}

/** List responses omit metadata, so recover only known, correctly mapped IMS tags. */
export function parseCompatEvent<T extends { action: string; description: string }>(event: T): T {
  const match = /^\[([a-z_]+\.[a-z_]+)\] ([\s\S]*)$/.exec(event.description);
  if (!match || !IMS_ACTIONS.includes(match[1] as ImsAuditAction)) return event;
  const action = match[1] as ImsAuditAction;
  if (action === event.action || toLegacyAuditAction(action) !== event.action) return event;
  return { ...event, action, description: match[2] };
}

/** Recursively omit service-forbidden keys, including keys inside arrays. */
export function safeAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const clean = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(clean);
    if (entry && typeof entry === "object") return Object.fromEntries(
      Object.entries(entry).filter(([key]) => !/password|token|secret|authorization|card|cvv/i.test(key)).map(([key, child]) => [key, clean(child)]),
    );
    return entry;
  };
  return clean(value) as Record<string, unknown>;
}
