-- Additive and repeatable. Extends BranchRequests, BranchRequestItems, and StockTransferRequests
-- for the POS -> IMS Branch Stock Request integration.
BEGIN;

ALTER TABLE "BranchRequests"
  ADD COLUMN IF NOT EXISTS "BranchName" varchar(256) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "RequestedByName" varchar(256) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "DecidedByName" varchar(256),
  ADD COLUMN IF NOT EXISTS "DecidedAt" timestamptz(6),
  ADD COLUMN IF NOT EXISTS "DecisionRemarks" varchar(500),
  ADD COLUMN IF NOT EXISTS "FulfilledAt" timestamptz(6),
  ADD COLUMN IF NOT EXISTS "PosSyncStatus" varchar(32) NOT NULL DEFAULT 'Synced',
  ADD COLUMN IF NOT EXISTS "PosSyncError" text,
  ADD COLUMN IF NOT EXISTS "PosManifestLinked" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "IX_BranchRequests_Status" ON "BranchRequests"("Status");

ALTER TABLE "BranchRequestItems"
  ADD COLUMN IF NOT EXISTS "Sku" varchar(128) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "ProductName" varchar(256) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "VariationName" varchar(256) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "PosProductId" varchar(128),
  ADD COLUMN IF NOT EXISTS "BranchCurrentStock" integer NOT NULL DEFAULT 0;

ALTER TABLE "StockTransferRequests"
  ADD COLUMN IF NOT EXISTS "BranchRequestId" integer REFERENCES "BranchRequests"("BranchRequestId") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "IX_StockTransferRequests_BranchRequestId"
  ON "StockTransferRequests"("BranchRequestId");

COMMIT;
