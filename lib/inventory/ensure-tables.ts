import { prisma } from "@/lib/prisma";

let tablesChecked = false;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "StockWriteOffs" (
    "WriteOffId" serial PRIMARY KEY,
    "SwoNumber" varchar(32) NOT NULL UNIQUE,
    "Status" varchar(32) NOT NULL DEFAULT 'Pending Approval'
      CHECK ("Status" IN ('Pending Approval', 'Approved', 'Rejected', 'Cancelled', 'Removed')),
    "RequestedBy" varchar(128) NOT NULL,
    "RequestedByName" varchar(256) NOT NULL DEFAULT '',
    "RequestedAt" timestamptz(6) NOT NULL DEFAULT NOW(),
    "GeneralRemarks" text,
    "ApprovedBy" varchar(128),
    "ApprovedByName" varchar(256),
    "ApprovedAt" timestamptz(6),
    "ApprovalNotes" text,
    "RejectedBy" varchar(128),
    "RejectedByName" varchar(256),
    "RejectedAt" timestamptz(6),
    "RejectionReason" text,
    "CancelledBy" varchar(128),
    "CancelledByName" varchar(256),
    "CancelledAt" timestamptz(6),
    "CancelReason" text,
    "RemovedBy" varchar(128),
    "RemovedByName" varchar(256),
    "RemovedAt" timestamptz(6),
    "TotalValue" decimal(18, 4) NOT NULL DEFAULT 0,
    "UpdatedAt" timestamptz(6) NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffs_Status" ON "StockWriteOffs"("Status");`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffs_RequestedAt" ON "StockWriteOffs"("RequestedAt" DESC);`,
  `CREATE TABLE IF NOT EXISTS "StockWriteOffItems" (
    "WriteOffItemId" serial PRIMARY KEY,
    "WriteOffId" integer NOT NULL REFERENCES "StockWriteOffs"("WriteOffId") ON DELETE CASCADE,
    "ItemId" integer NOT NULL REFERENCES "Items"("ItemId") ON UPDATE NO ACTION,
    "ProductId" integer REFERENCES "FinishedProducts"("ProductId") ON DELETE SET NULL ON UPDATE NO ACTION,
    "ItemType" varchar(128) NOT NULL DEFAULT '',
    "ItemName" varchar(256) NOT NULL DEFAULT '',
    "ItemCode" varchar(128) NOT NULL DEFAULT '',
    "VariantName" varchar(128) NOT NULL DEFAULT '',
    "UomId" integer NOT NULL REFERENCES "UnitOfMeasures"("UomId") ON UPDATE NO ACTION,
    "UomName" varchar(64) NOT NULL DEFAULT 'Unit',
    "HasExpiry" boolean NOT NULL DEFAULT true
  );`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffItems_WriteOffId" ON "StockWriteOffItems"("WriteOffId");`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffItems_ItemId" ON "StockWriteOffItems"("ItemId");`,
  `CREATE TABLE IF NOT EXISTS "StockWriteOffLines" (
    "LineId" serial PRIMARY KEY,
    "WriteOffItemId" integer NOT NULL REFERENCES "StockWriteOffItems"("WriteOffItemId") ON DELETE CASCADE,
    "LotId" integer NOT NULL REFERENCES "InventoryLots"("LotId") ON UPDATE NO ACTION,
    "LotCode" varchar(128) NOT NULL DEFAULT '',
    "ExpiryDate" date,
    "AvailableBefore" decimal(18, 3) NOT NULL DEFAULT 0,
    "Quantity" decimal(18, 3) NOT NULL CHECK ("Quantity" > 0),
    "UnitCost" decimal(18, 6) NOT NULL DEFAULT 0,
    "Reason" varchar(128) NOT NULL,
    "ReasonOther" varchar(256),
    "Disposition" varchar(128) NOT NULL,
    "DispositionOther" varchar(256),
    "Remarks" text NOT NULL DEFAULT '',
    "LedgerId" bigint REFERENCES "StockLedgers"("LedgerId") ON DELETE SET NULL ON UPDATE NO ACTION
  );`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffLines_WriteOffItemId" ON "StockWriteOffLines"("WriteOffItemId");`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffLines_LotId" ON "StockWriteOffLines"("LotId");`,
  `CREATE TABLE IF NOT EXISTS "StockWriteOffPhotos" (
    "PhotoId" serial PRIMARY KEY,
    "WriteOffItemId" integer NOT NULL REFERENCES "StockWriteOffItems"("WriteOffItemId") ON DELETE CASCADE,
    "FileId" text NOT NULL,
    "FileName" varchar(256) NOT NULL DEFAULT '',
    "ContentType" varchar(128) NOT NULL DEFAULT 'image/jpeg',
    "FileSize" integer NOT NULL DEFAULT 0,
    "UploadedAt" timestamptz(6) NOT NULL DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS "IX_StockWriteOffPhotos_WriteOffItemId" ON "StockWriteOffPhotos"("WriteOffItemId");`,
];

export async function ensureStockWriteOffTables(): Promise<void> {
  if (tablesChecked) return;
  if (typeof (prisma as any)?.$executeRawUnsafe !== "function") return;
  try {
    for (const stmt of DDL_STATEMENTS) {
      await prisma.$executeRawUnsafe(stmt);
    }
    tablesChecked = true;
  } catch (err) {
    console.warn("[STOCK-WRITE-OFF] Table ensure error:", err);
  }
}
