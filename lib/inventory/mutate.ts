import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit, type AuditAction } from "@/lib/audit";
import type { Staff } from "@/lib/portal/client";
import { resourceResult, type ResourceResult } from "@/lib/resources/result";

type Saved = { result: ResourceResult; audit?: AuditAction; after?: () => Promise<void> };
class Refusal extends Error {}
export function refuse(message: string): never { throw new Refusal(message); }
export function positiveId(input: string | number): number {
  if (typeof input !== "number" && typeof input !== "string") refuse("Select a valid record.");
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) refuse("Select a valid record.");
  return id;
}

function failed(error: unknown): ResourceResult {
  if (error instanceof Refusal) return resourceResult({ success: false, message: error.message });
  console.error("Inventory action failed", error);
  return resourceResult({ success: false, message: "Unable to complete the inventory action. Please try again." });
}

export async function read(work: () => Promise<ResourceResult>): Promise<ResourceResult> {
  try { return await work(); } catch (error) { return failed(error); }
}

export async function mutate(staff: Staff, work: (tx: Prisma.TransactionClient) => Promise<Saved>): Promise<ResourceResult> {
  let saved: Saved;
  try {
    // Serialize state transitions so concurrent approvals/posts cannot both save.
    saved = await prisma.$transaction(work, { isolationLevel: "Serializable" });
  } catch (error) { return failed(error); }
  if (saved.audit) await recordAudit(staff, saved.audit);
  if (saved.after) await saved.after().catch(error => console.error("Notification could not be sent", error));
  revalidatePath("/cycle-counts");
  revalidatePath("/traceability");
  revalidatePath("/valuation");
  revalidatePath("/inventory");
  return saved.result;
}

export function pageNumber(value: string | null, fallback: number, max: number): number {
  if (value === null) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) refuse("Invalid pagination.");
  return Math.min(number, max);
}
