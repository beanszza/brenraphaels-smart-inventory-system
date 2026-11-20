-- Additive and repeatable. Run before deploying the shop stock interface.
BEGIN;
CREATE TABLE IF NOT EXISTS "ShopStockLines" (
  "OrderId" varchar(128) NOT NULL,
  "LineId" varchar(128) NOT NULL,
  "ProductId" integer NOT NULL REFERENCES "FinishedProducts"("ProductId"),
  "WarehouseId" integer NOT NULL REFERENCES "Locations"("LocationId"),
  "Quantity" decimal(18,3) NOT NULL CHECK ("Quantity" > 0),
  "State" varchar(16) NOT NULL CHECK ("State" IN ('reserved', 'released', 'deducted', 'added_back')),
  "Allocations" jsonb NOT NULL,
  PRIMARY KEY ("OrderId", "LineId")
);
CREATE TABLE IF NOT EXISTS "ShopStockAuditOutbox" (
  "Key" varchar(64) PRIMARY KEY,
  "Event" jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS "ShopStockSnapshots" (
  "ProductId" integer PRIMARY KEY,
  "Fingerprint" varchar(512) NOT NULL
);
COMMIT;
