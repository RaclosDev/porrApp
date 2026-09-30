-- ============================================================================
-- V12__rename_legacy_tables.sql
--
-- Renombra las tablas antiguas de la fase 0 que ya no se usan en la app
-- para identificarlas claramente como legado.
-- ============================================================================

ALTER TABLE user_accounts RENAME TO legacy_user_accounts;
ALTER TABLE bet_groups RENAME TO legacy_bet_groups;
ALTER TABLE bets RENAME TO legacy_bets;
