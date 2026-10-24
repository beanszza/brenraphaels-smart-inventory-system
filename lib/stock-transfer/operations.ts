import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit, type AuditAction } from "@/lib/audit";
import type { Staff } from "@/lib/portal/client";
import { resourceResult, type ResourceResult } from "@/lib/resources/result";

export type Saved = { result: ResourceResult; audit: AuditAction; after?: () => Promise<void> };
class Refusal extends Error {}
export function refuse(message: string): never { throw new Refusal(message); }
export function positiveId(input: unknown): number {
  if (typeof input !== "number" && typeof input !== "string") refuse("Select a valid record.");
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) refuse("Select a valid record.");
  return id;
}

/** Validate untrusted action input; attribution always comes from the Portal session. */
export function validateInput(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) refuse("Invalid transfer details.");
  for (const [key, value] of Object.entries(input)) {
    if (["requestedBy", "reviewedBy", "receivedBy", "createdBy", "userId", "userName"].includes(key)) continue;
    if (value === undefined || value === null) continue;
    if (key === "items") {
      if (!Array.isArray(value) || !value.length || value.length > 100) refuse("Select between 1 and 100 items.");
      value.forEach(validateInput);
    } else if (/Id$/.test(key)) positiveId(value);
    else if (/quantity/i.test(key)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) refuse("Quantities must be finite positive numbers.");
    } else if (/date$/i.test(key)) {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) refuse("Enter a valid date.");
    } else if (typeof value !== "string" || value.length > 10000) refuse("Invalid transfer details.");
  }
}
export function saved(staff: Staff, type: string, id: number, name: string, change: AuditAction["change"], result: ResourceResult, after?: () => Promise<void>): Saved {
  return { result, audit: { module: "Stock Transfer", change, target: { type, id, name }, description: `${staff.name} ${change} ${type} (${name})` }, after };
}

function failed(error: unknown): ResourceResult {
  if (error instanceof Refusal) return resourceResult({ success: false, message: error.message });
  console.error("Stock Transfer action failed", error);
  return resourceResult({ success: false, message: "Unable to complete the stock transfer action. Please try again." });
}
export async function read(work: () => Promise<ResourceResult>): Promise<ResourceResult> {
  try { return await work(); } catch (error) { return failed(error); }
}
export async function mutate(staff: Staff, work: (tx: Prisma.TransactionClient) => Promise<Saved>): Promise<ResourceResult> {
  let saved: Saved;
  try { saved = await prisma.$transaction(work, { isolationLevel: "Serializable" }); }
  catch (error) { return failed(error); }
  if (saved.audit) await recordAudit(staff, saved.audit);
  if (saved.after) await saved.after().catch(error => console.error("Notification could not be sent", error));
  revalidatePath("/stock-transfer");
  revalidatePath("/inventory");
  revalidatePath("/distribution-analytics");
  return saved.result;
}
