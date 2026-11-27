-- Liga de póker abierta: cualquier miembro prepara, edita y dirige los torneos.
ALTER TABLE leagues ADD COLUMN poker_everyone_organizes BOOLEAN NOT NULL DEFAULT FALSE;
