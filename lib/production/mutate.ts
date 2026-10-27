import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit, type AuditAction } from "@/lib/audit";
import type { Staff } from "@/lib/portal/client";
import { resourceResult, type ResourceResult } from "@/lib/resources/result";

type Saved = { result: ResourceResult; audit?: AuditAction; after?: () => Promise<void> };
class Refusal extends Error {}
export function refuse(message: string): never { throw new Refusal(message); }
export function positiveId(input: unknown): number {
  if (typeof input !== "number" && typeof input !== "string") refuse("Select a valid record.");
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) refuse("Select a valid record.");
  return id;
}

/** Validate action input even when no form was involved. Identity fields are ignored by the operations. */
export function validateInput(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) refuse("Invalid production details.");
  for (const [key, value] of Object.entries(input)) {
    if (["userId", "userName", "requestedBy", "issuedBy", "scannedBy", "assignedCook", "packagedBy", "packedBy", "completedBy", "inspectorName", "approvedBy", "rejectedBy", "authorisedBy"].includes(key)) continue;
    if (value === undefined || value === null) continue;
    if (/Id$/.test(key)) positiveId(value);
    else if (/quantity|price/i.test(key)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) refuse("Quantities and prices must be finite, non-negative numbers.");
    } else if (/date$/i.test(key)) {
      if (value === "") continue;
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) refuse("Enter a valid date.");
    } else if (key === "checklist") {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.values(value).some(v => typeof v !== "boolean")) refuse("Invalid quality checklist.");
    } else if (["isApproved", "bypassScanCheck", "isActive", "submitForApproval"].includes(key)) {
      if (typeof value !== "boolean") refuse("Invalid production details.");
    } else if (typeof value !== "string" || value.length > 10000) refuse("Invalid production details.");
  }
}

function failed(error: unknown): ResourceResult {
  if (error instanceof Refusal) return resourceResult({ success: false, message: error.message });
  console.error("Production action failed", error);
  return resourceResult({ success: false, message: "Unable to complete the production action. Please try again." });
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
  revalidatePath("/production-quality");
  revalidatePath("/inventory");
  revalidatePath("/orders-procurement");
  return saved.result;
}
