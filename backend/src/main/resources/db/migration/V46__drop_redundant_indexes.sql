-- ============================================================================
-- V46__drop_redundant_indexes.sql
--
-- Índices que repiten a otro y solo encarecen cada escritura:
--   - idx_pronosticos_partido_prediction (prediction_id): lo cubre uq_prediction_match,
--     que empieza por esa columna.
--   - idx_pronosticos_partido_pred_match (prediction_id, match_id): mismo índice que
--     el de la restricción única uq_prediction_match.
--   - idx_pronosticos_partido_match_id (match_id): igual que idx_pronosticos_partido_match.
--   - idx_app_users_google_email (google_email): igual que el de la restricción única
--     app_users_google_email_key.
-- ============================================================================

DROP INDEX IF EXISTS idx_pronosticos_partido_prediction;
DROP INDEX IF EXISTS idx_pronosticos_partido_pred_match;
DROP INDEX IF EXISTS idx_pronosticos_partido_match_id;
DROP INDEX IF EXISTS idx_app_users_google_email;
