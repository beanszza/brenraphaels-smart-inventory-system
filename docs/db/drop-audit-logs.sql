-- #11: the field-level "AuditLogs" table was never written to; audit events now live in the central audit service.
-- Run once per environment against the IMS database. Safe to re-run.
DROP TABLE IF EXISTS "AuditLogs";
