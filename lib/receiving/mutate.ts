import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit, type AuditAction } from "@/lib/audit";
import type { Staff } from "@/lib/portal/client";
import { resourceResult, type ResourceResult } from "@/lib/resources/result";

type Saved = { result: ResourceResult; audit: AuditAction; after?: () => Promise<void> };
class Refusal extends Error {}
export function refuse(message: string): never { throw new Refusal(message); }
export function positiveId(input: string | number): number {
  if (typeof input !== "number" && typeof input !== "string") refuse("Select a valid record.");
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) refuse("Select a valid record.");
  return id;
}

// Server actions are public entry points: reject malformed objects and non-finite quantities
// even when called without the form's validation. Attribution is never read from these inputs.
export function validateInput(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) refuse("Invalid receiving details.");
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (/Id$/.test(key)) {
      positiveId(value as number);
    } else if (/(?:Quantity$|^quantityToStock$|^currentStockBeforeCommit$)/i.test(key)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) refuse("Quantities must be finite, non-negative numbers.");
    } else if (/date$/i.test(key)) {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) refuse("Enter a valid date.");
    } else if (["items", "lines"].includes(key)) {
      if (!Array.isArray(value) || value.length === 0 || value.length > 500) refuse("Include between 1 and 500 item lines.");
      value.forEach(validateInput);
    } else if (["submitForApproval", "physicalQuantityVerified", "itemsMatchPurchaseOrder", "supplierDocumentsChecked", "packagingConditionChecked"].includes(key)) {
      if (typeof value !== "boolean") refuse("Invalid approval request.");
    } else if (typeof value !== "string" || value.length > 10000) refuse("Invalid receiving details.");
  }
}

function failed(error: unknown): ResourceResult {
  if (error instanceof Refusal) return resourceResult({ success: false, message: error.message });
  console.error("Goods Receiving action failed", error);
  const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
  return resourceResult({ success: false, message: `Unable to complete the receiving action. Please try again.${detail}` });
}

export async function read(work: () => Promise<ResourceResult>): Promise<ResourceResult> {
  try { return await work(); } catch (error) { return failed(error); }
}

export async function mutate(staff: Staff, work: (tx: Prisma.TransactionClient) => Promise<Saved>): Promise<ResourceResult> {
  let saved: Saved;
  try {
    // Serialize state transitions so concurrent approvals/posts cannot both save.
    saved = await prisma.$transaction(work, {
      isolationLevel: "Serializable",
      maxWait: 15000,
      timeout: 30000,
    });
  } catch (error) { return failed(error); }
  await recordAudit(staff, saved.audit);
  if (saved.after) await saved.after().catch(error => console.error("Notification could not be sent", error));
  revalidatePath("/goods-receiving");
  revalidatePath("/orders-procurement");
  revalidatePath("/inventory");
  return saved.result;
}
