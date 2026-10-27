-- V37: Unificar competiciones legacy (external_id NULL) con sus equivalentes canónicas.
-- Las competiciones sin external_id no se pueden sincronizar con ESPN, por lo que las
-- ligas creadas sobre ellas se quedaban sin equipos ni partidos.

-- 1. Champions League legacy -> UEFA Champions League
UPDATE editions e
SET competition_id = canon.id
FROM competitions canon
WHERE canon.external_id = 'uefa.champions'
  AND e.competition_id IN (
      SELECT legacy.id
      FROM competitions legacy
      WHERE legacy.external_id IS NULL
        AND lower(trim(legacy.name)) = 'champions league'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM editions existing
      WHERE existing.league_id = e.league_id
        AND existing.competition_id = canon.id
  );

-- 2. La Liga legacy -> LaLiga EA Sports
UPDATE editions e
SET competition_id = canon.id
FROM competitions canon
WHERE canon.external_id = 'esp.1'
  AND e.competition_id IN (
      SELECT legacy.id
      FROM competitions legacy
      WHERE legacy.external_id IS NULL
        AND lower(trim(legacy.name)) IN ('la liga', 'laliga')
  )
  AND NOT EXISTS (
      SELECT 1
      FROM editions existing
      WHERE existing.league_id = e.league_id
        AND existing.competition_id = canon.id
  );

-- 3. Mundial legacy -> FIFA World Cup 2026
UPDATE editions e
SET competition_id = canon.id
FROM competitions canon
WHERE canon.external_id = 'fifa.world'
  AND e.competition_id IN (
      SELECT legacy.id
      FROM competitions legacy
      WHERE legacy.external_id IS NULL
        AND lower(trim(legacy.name)) IN ('mundial 2026', 'mundial')
  )
  AND NOT EXISTS (
      SELECT 1
      FROM editions existing
      WHERE existing.league_id = e.league_id
        AND existing.competition_id = canon.id
  );

-- 4. Eliminar competiciones legacy que ya no tengan ediciones ni partidos asociados.
DELETE FROM competitions c
WHERE c.external_id IS NULL
  AND lower(trim(c.name)) IN ('champions league', 'la liga', 'laliga', 'mundial 2026', 'mundial')
  AND NOT EXISTS (SELECT 1 FROM editions e WHERE e.competition_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.competition_id = c.id);
