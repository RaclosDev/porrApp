-- ============================================================================
-- V44__unique_match_external_id.sql
--
-- La sincronización busca cada partido por su id de ESPN (external_id), pero la
-- columna no era única: una importación y una sincronización a la vez podían
-- crear el mismo partido dos veces, y desde entonces findByExternalId falla.
--
-- Antes de crear el UNIQUE se fusionan los duplicados sin perder pronósticos:
--   1. Por cada external_id repetido se conserva un partido: el terminado con
--      marcador si lo hay; si no, el que tiene más pronósticos; y a igualdad, el
--      más antiguo.
--   2. Si una porra pronosticó en dos copias del mismo partido, se queda el
--      pronóstico que guardó más tarde.
--   3. El resto de pronósticos pasa al partido conservado y sus porras se
--      marcan para recalcular la puntuación.
--   4. Se borran las copias y se crea el UNIQUE.
-- Si no hay duplicados, solo se crea el UNIQUE.
-- ============================================================================

-- Un id vacío no identifica ningún partido de ESPN.
UPDATE matches SET external_id = NULL WHERE btrim(external_id) = '';

CREATE TEMPORARY TABLE match_duplicates ON COMMIT DROP AS
WITH duplicated AS (
    SELECT external_id
    FROM matches
    WHERE external_id IS NOT NULL
    GROUP BY external_id
    HAVING count(*) > 1
), ranked AS (
    SELECT m.id,
           m.external_id,
           ROW_NUMBER() OVER (
               PARTITION BY m.external_id
               ORDER BY (m.finished IS TRUE AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL) DESC,
                        (SELECT count(*) FROM pronosticos_partido pp WHERE pp.match_id = m.id) DESC,
                        m.id ASC
           ) AS position
    FROM matches m
    JOIN duplicated d ON d.external_id = m.external_id
)
SELECT copy.id AS duplicate_id, keeper.id AS keeper_id
FROM ranked copy
JOIN ranked keeper ON keeper.external_id = copy.external_id AND keeper.position = 1
WHERE copy.position > 1;

-- 2. Una porra con pronóstico en varias copias del partido conserva el último que guardó.
WITH affected AS (
    SELECT pp.id,
           pp.prediction_id,
           COALESCE(d.keeper_id, pp.match_id) AS keeper_id,
           pp.updated_at
    FROM pronosticos_partido pp
    LEFT JOIN match_duplicates d ON d.duplicate_id = pp.match_id
    WHERE d.duplicate_id IS NOT NULL
       OR pp.match_id IN (SELECT keeper_id FROM match_duplicates)
), ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY prediction_id, keeper_id
               ORDER BY updated_at DESC NULLS LAST, id DESC
           ) AS position
    FROM affected
)
DELETE FROM pronosticos_partido
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

-- 3. El resto de pronósticos pasa al partido que se conserva.
UPDATE pronosticos_partido pp
SET match_id = d.keeper_id
FROM match_duplicates d
WHERE pp.match_id = d.duplicate_id;

UPDATE matches keeper
SET competition_id = copy.competition_id
FROM match_duplicates d
JOIN matches copy ON copy.id = d.duplicate_id
WHERE keeper.id = d.keeper_id
  AND keeper.competition_id IS NULL
  AND copy.competition_id IS NOT NULL;

UPDATE predictions
SET score_calculated_at = NULL
WHERE id IN (
    SELECT pp.prediction_id
    FROM pronosticos_partido pp
    WHERE pp.match_id IN (SELECT keeper_id FROM match_duplicates)
);

-- 4. Sin pronósticos colgando de ellas, las copias ya se pueden borrar.
DELETE FROM matches WHERE id IN (SELECT duplicate_id FROM match_duplicates);

ALTER TABLE matches ADD CONSTRAINT uq_matches_external_id UNIQUE (external_id);
