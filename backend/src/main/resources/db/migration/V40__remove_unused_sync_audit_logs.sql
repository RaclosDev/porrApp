-- The sync audit history is not exposed by any controller or UI and duplicates operational logs.
-- Keep the live sync status in memory/logging; remove the unused persisted audit table.
DROP TABLE IF EXISTS sync_audit_logs;
