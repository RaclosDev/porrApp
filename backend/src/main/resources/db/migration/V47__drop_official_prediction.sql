-- ============================================================================
-- V47__drop_official_prediction.sql
--
-- Los resultados oficiales ya no se guardan como un pronóstico más de la cuenta
-- interna Admin: los calcula OfficialResultsService con los partidos y la
-- clasificación sincronizados. Se borran ese pronóstico (y cualquier otro de la
-- cuenta Admin, que no puede iniciar sesión) y la columna que lo marcaba.
-- Sus pronósticos por partido caen con él (ON DELETE CASCADE).
-- ============================================================================

DELETE FROM predictions
WHERE is_official = TRUE
   OR user_id IN (SELECT id FROM app_users WHERE LOWER(google_email) = 'admin@local');

DROP INDEX IF EXISTS uq_predictions_single_official;
DROP INDEX IF EXISTS idx_predictions_is_official;
ALTER TABLE predictions DROP COLUMN IF EXISTS is_official;
