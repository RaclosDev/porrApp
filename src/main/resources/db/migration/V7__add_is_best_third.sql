-- ============================================================================
-- V7__add_is_best_third.sql
-- ============================================================================

ALTER TABLE pronosticos_grupo ADD COLUMN is_best_third BOOLEAN DEFAULT FALSE;
