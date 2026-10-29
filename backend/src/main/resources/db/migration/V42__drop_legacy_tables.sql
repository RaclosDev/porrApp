-- ============================================================================
-- V42__drop_legacy_tables.sql
--
-- Elimina las tablas de la fase 0 que V12 renombró a legacy_* y que ya no usa
-- ninguna parte de la aplicación (el modelo actual vive en user_accounts,
-- leagues, memberships, editions y predictions).
-- ============================================================================

DROP TABLE IF EXISTS legacy_bets;
DROP TABLE IF EXISTS legacy_bet_groups;
DROP TABLE IF EXISTS legacy_user_accounts;
