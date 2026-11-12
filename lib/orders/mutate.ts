import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit, auditVersion, type AuditAction } from "@/lib/audit";
import type { Staff } from "@/lib/portal/client";
import { errorMessage, resourceResult, type ResourceResult } from "@/lib/resources/result";

export type Saved = { result: ResourceResult; audit?: AuditAction; after?: () => Promise<void> };

export const fail = (message: string): Saved => ({ result: resourceResult({ success: false, message }) });

/**
 * Runs one state-changing action: the work commits first, then its audit event and any
 * notifications follow. Both are best effort and never reach the caller, and neither is
 * sent as successful events for work that refused or failed to commit. Refused
 * review attempts with an explicit audit context emit a failure event after the transaction.
 */
export async function mutate(staff: Staff, work: (tx: Prisma.TransactionClient) => Promise<Saved>, attempt?: AuditAction): Promise<ResourceResult> {
  try {
    const saved = await prisma.$transaction(work, {
      isolationLevel: "Serializable",
      maxWait: 15000,
      timeout: 30000,
    });
    if (!saved.result.success && attempt) await recordAudit(staff, { ...attempt, outcome: "failure", version: auditVersion({ attempt, reason: saved.result.message }) });
    if (saved.audit) await recordAudit(staff, { ...saved.audit, version: saved.audit.version ?? auditVersion(saved.result.data) });
    if (saved.audit && saved.after) await saved.after().catch((error) => console.error("Notification could not be sent", error));
    if (saved.result.success) {
      revalidatePath("/orders-procurement", "layout");
      revalidatePath("/reports");
      revalidatePath("/mrp");
    }
    return saved.result;
  } catch (error) {
    console.error("Orders & Procurement action failed", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

/** Reads wrap their body the same way so every refusal is a result rather than a thrown error. */
export async function read(work: () => Promise<ResourceResult>): Promise<ResourceResult> {
  try {
    return await work();
  } catch (error) {
    console.error("Orders & Procurement read failed", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}
