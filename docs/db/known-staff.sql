-- #15: Staff IMS has seen sign in, with the Modules they held then. Only decides who to notify; never grants access.
-- Run once per environment against the IMS database. Safe to re-run.
CREATE TABLE IF NOT EXISTS "KnownStaff" (
  "StaffId"  text        NOT NULL,
  "Name"     text        NOT NULL,
  "Username" text        NOT NULL,
  "Modules"  text[]      NOT NULL,
  "SeenAt"   timestamptz NOT NULL,
  CONSTRAINT "PK_KnownStaff" PRIMARY KEY ("StaffId")
);
