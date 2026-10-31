-- Las ligas creadas después de V24 no heredaban el cierre del torneo.
-- Conserva fechas configuradas explícitamente y el cierre por partido de MATCH_DAY.
UPDATE editions e
SET lock_date = TIMESTAMP '2026-06-11 20:00:00'
FROM competitions c
WHERE e.competition_id = c.id
  AND c.external_id = 'fifa.world'
  AND e.pool_format IN ('FULL_BRACKET', 'KNOCKOUTS_ONLY')
  AND e.lock_date IS NULL;
