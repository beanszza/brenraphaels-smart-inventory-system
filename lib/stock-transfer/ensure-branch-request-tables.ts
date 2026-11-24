import { prisma } from "@/lib/prisma";

let branchRequestColumnsChecked = false;

const DDL_STATEMENTS = [
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "BranchName" varchar(256) NOT NULL DEFAULT '';`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "RequestedByName" varchar(256) NOT NULL DEFAULT '';`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "DecidedByName" varchar(256);`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "DecidedAt" timestamptz(6);`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "DecisionRemarks" varchar(500);`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "FulfilledAt" timestamptz(6);`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "PosSyncStatus" varchar(32) NOT NULL DEFAULT 'Synced';`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "PosSyncError" text;`,
  `ALTER TABLE "BranchRequests" ADD COLUMN IF NOT EXISTS "PosManifestLinked" boolean NOT NULL DEFAULT false;`,
  `CREATE INDEX IF NOT EXISTS "IX_BranchRequests_Status" ON "BranchRequests"("Status");`,
  `ALTER TABLE "BranchRequestItems" ADD COLUMN IF NOT EXISTS "Sku" varchar(128) NOT NULL DEFAULT '';`,
  `ALTER TABLE "BranchRequestItems" ADD COLUMN IF NOT EXISTS "ProductName" varchar(256) NOT NULL DEFAULT '';`,
  `ALTER TABLE "BranchRequestItems" ADD COLUMN IF NOT EXISTS "VariationName" varchar(256) NOT NULL DEFAULT '';`,
  `ALTER TABLE "BranchRequestItems" ADD COLUMN IF NOT EXISTS "PosProductId" varchar(128);`,
  `ALTER TABLE "BranchRequestItems" ADD COLUMN IF NOT EXISTS "BranchCurrentStock" integer NOT NULL DEFAULT 0;`,
  `ALTER TABLE "StockTransferRequests" ADD COLUMN IF NOT EXISTS "BranchRequestId" integer REFERENCES "BranchRequests"("BranchRequestId") ON DELETE SET NULL ON UPDATE NO ACTION;`,
  `CREATE INDEX IF NOT EXISTS "IX_StockTransferRequests_BranchRequestId" ON "StockTransferRequests"("BranchRequestId");`,
];

/**
 * Idempotently ensures the additive POS Branch Stock Request columns exist in PostgreSQL
 * on first access in production (matching lib/inventory/ensure-tables.ts).
 */
export async function ensureBranchRequestColumns(): Promise<void> {
  if (branchRequestColumnsChecked) return;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  if (typeof (prisma as unknown as { $executeRawUnsafe?: unknown })?.$executeRawUnsafe !== "function") return;
  try {
    for (const stmt of DDL_STATEMENTS) {
      await prisma.$executeRawUnsafe(stmt);
    }
    branchRequestColumnsChecked = true;
  } catch (err) {
    console.warn("[BRANCH-REQUESTS] Schema ensure warning:", err);
  }
}
