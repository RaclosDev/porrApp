-- ============================================================================
-- V10__drop_participant_name_unique.sql
--
-- Elimina la restricción de que el nombre del participante sea único.
-- ============================================================================

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_participant_name_key;
