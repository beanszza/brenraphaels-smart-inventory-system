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
  "stock_transfer.requested", "stock_transfer.approved", "stock_transfer.rejected", "stock_transfer.dispatched", "stock_transfer.received",
  "ims.signed_in", "ims.access_denied",
] as const;
export type ImsAuditAction = typeof IMS_ACTIONS[number];
export function auditActionLabel(action: string): string {
  return action.replaceAll(/[._]/g, " ").replace(/^\w/, c => c.toUpperCase());
}
export function toLegacyAuditAction(action: ImsAuditAction): "record.created" | "record.updated" | "record.deleted" | "record.viewed" {
  if (action.startsWith("record.")) return action as ReturnType<typeof toLegacyAuditAction>;
  if (action.startsWith("ims.")) return "record.viewed";
  return /\.(created|submitted|requested)$/.test(action) || ["delivery.received", "delivery.discrepancy_logged", "material.issued", "stock_in.put_away"].includes(action) ? "record.created" : "record.updated";
}
export const formatCompatDescription = (action: ImsAuditAction, description: string) =>
  action.startsWith("record.") ? description : `[${action}] ${description}`;
export function parseCompatEvent<T extends { action: string; description: string }>(event: T): T {
  const match = /^\[([^\]]+)\] /.exec(event.description);
  if (!event.action.startsWith("record.") || !match || !IMS_ACTIONS.includes(match[1] as ImsAuditAction)) return event;
  return { ...event, action: match[1], description: event.description.slice(match[0].length) };
}
/** Replace invalid Unicode before it reaches the append-only store. */
export const auditText = (text: string): string => text.replace(/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
export function safeAuditMetadata(input: unknown): Record<string, unknown> {
  const seen = new WeakSet<object>();
  function clean(value: unknown, depth: number): unknown {
    if (typeof value === "string") return auditText(value);
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (!value || typeof value !== "object" || depth > 30 || seen.has(value)) return null;
    seen.add(value);
    const result = Array.isArray(value) ? value.map(v => clean(v, depth + 1)) :
      Object.fromEntries(Object.entries(value).filter(([key]) => !/password|token|secret|authorization|card|cvv/i.test(auditText(key))).map(([key, v]) => [auditText(key), clean(v, depth + 1)]));
    seen.delete(value);
    return result;
  }
  const result = input && typeof input === "object" && !Array.isArray(input) ? clean(input, 0) as Record<string, unknown> : {};
  return new TextEncoder().encode(JSON.stringify(result)).length <= 4096 ? result : {};
}
