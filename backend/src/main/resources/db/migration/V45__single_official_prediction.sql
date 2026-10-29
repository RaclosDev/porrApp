-- ============================================================================
-- V45__single_official_prediction.sql
--
-- Solo puede haber un cuadro oficial: findByIsOfficialTrue() devuelve un Optional
-- y con dos filas marcadas falla. Antes cualquier usuario podía marcar el suyo
-- llamándolo "official". Se conserva el legítimo y se quita la marca al resto,
-- sin borrar filas:
--   1. el de la cuenta interna Admin (admin@local), que es quien lo crea;
--   2. si no hay ninguno suyo, el más antiguo (el que marcó V15).
-- ============================================================================

UPDATE predictions
SET is_official = FALSE
WHERE is_official = TRUE
  AND id <> (
    SELECT p.id
    FROM predictions p
    LEFT JOIN app_users u ON u.id = p.user_id
    WHERE p.is_official = TRUE
    ORDER BY (LOWER(u.google_email) = 'admin@local') IS TRUE DESC, p.id ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_predictions_single_official
    ON predictions (is_official)
    WHERE is_official = TRUE;
