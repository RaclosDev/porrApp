-- Modo de cierre de los pronósticos de una edición y margen antes del partido.
ALTER TABLE editions ADD COLUMN lock_mode VARCHAR(20) NOT NULL DEFAULT 'FIXED_DATE';
ALTER TABLE editions ADD COLUMN lock_offset_minutes INTEGER NOT NULL DEFAULT 0;
