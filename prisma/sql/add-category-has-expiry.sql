-- Add HasExpiry flag to Categories; existing categories default to true (Has Expiry)
ALTER TABLE "Categories" ADD COLUMN IF NOT EXISTS "HasExpiry" boolean NOT NULL DEFAULT true;

