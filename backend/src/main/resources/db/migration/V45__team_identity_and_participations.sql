-- A un equipo lo identifica su id externo, unico entre deportes y proveedores, y no su nombre; y cada
-- competicion sabe que equipos juegan en ella.

-- 1. El futbol de ESPN era el unico deporte con el id numerico a secas (los demas ya llevan el prefijo de
--    su deporte: nba-, nfl:, lol-, tennis-, ufc-a). Un numero a secas es siempre un equipo de futbol.
UPDATE teams SET external_id = 'soccer-' || external_id WHERE external_id ~ '^[0-9]+$';

-- 2. El comodin "Por definir" no es de ningun proveedor: un hueco "TBD" del calendario le habia dejado su id.
UPDATE teams SET external_id = NULL
WHERE competition_id IS NULL AND (lower(name) IN ('por definir', 'tbd') OR lower(coalesce(name_en, '')) = 'tbd');

-- 3. Dos clubes pueden llamarse igual: el nombre deja de ser unico en el catalogo y pasa a serlo el id externo.
DROP INDEX uq_teams_catalog_name;
CREATE INDEX idx_teams_catalog_name ON teams (name) WHERE competition_id IS NULL;
CREATE UNIQUE INDEX uq_teams_external_id ON teams (external_id) WHERE external_id IS NOT NULL;

-- 4. El Liverpool ingles (ESPN 364) y el uruguayo (ESPN 5492) compartian fila por llamarse igual, y el id y
--    el escudo eran los del ultimo que se importaba. La fila se queda con el ingles, que juega casi todos sus
--    partidos, y el uruguayo recibe la suya con sus partidos de la Libertadores. Sin esa fila no hace nada.
DO $$
DECLARE
    shared_id bigint;
    uruguayan_id bigint;
BEGIN
    SELECT t.id INTO shared_id
    FROM teams t
    WHERE t.competition_id IS NULL AND t.name = 'Liverpool' AND t.external_id IN ('soccer-364', 'soccer-5492')
      AND EXISTS (SELECT 1 FROM matches m JOIN competitions c ON c.id = m.competition_id
                  WHERE t.id IN (m.home_team_id, m.away_team_id) AND c.external_id = 'conmebol.libertadores')
      AND EXISTS (SELECT 1 FROM matches m JOIN competitions c ON c.id = m.competition_id
                  WHERE t.id IN (m.home_team_id, m.away_team_id)
                    AND c.external_id IN ('eng.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf'))
      AND NOT EXISTS (SELECT 1 FROM teams other WHERE other.id <> t.id
                      AND other.external_id IN ('soccer-364', 'soccer-5492'))
    ORDER BY t.id
    LIMIT 1;
    IF shared_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE teams
    SET external_id = 'soccer-364', logo_url = 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png'
    WHERE id = shared_id;
    INSERT INTO teams (name, name_en, external_id, logo_url)
    VALUES ('Liverpool', 'Liverpool', 'soccer-5492', 'https://a.espncdn.com/i/teamlogos/soccer/500/5492.png')
    RETURNING id INTO uruguayan_id;

    UPDATE matches m SET home_team_id = uruguayan_id
    FROM competitions c
    WHERE c.id = m.competition_id AND c.external_id = 'conmebol.libertadores' AND m.home_team_id = shared_id;
    UPDATE matches m SET away_team_id = uruguayan_id
    FROM competitions c
    WHERE c.id = m.competition_id AND c.external_id = 'conmebol.libertadores' AND m.away_team_id = shared_id;
    UPDATE matches m SET winner_team_id = uruguayan_id
    FROM competitions c
    WHERE c.id = m.competition_id AND c.external_id = 'conmebol.libertadores' AND m.winner_team_id = shared_id;
    UPDATE group_standings gs SET team_id = uruguayan_id
    FROM competitions c
    WHERE c.id = gs.competition_id AND c.external_id = 'conmebol.libertadores' AND gs.team_id = shared_id;
END $$;

-- 5. Cada equipo queda ligado a las competiciones en las que juega algun partido. Las participaciones con
--    grupo (sorteos y competiciones propias) ya existian y no se tocan.
INSERT INTO competition_teams (competition_id, team_id)
SELECT DISTINCT m.competition_id, t.id
FROM matches m
JOIN teams t ON t.id IN (m.home_team_id, m.away_team_id)
WHERE m.competition_id IS NOT NULL
  AND lower(t.name) NOT IN ('por definir', 'tbd')
  AND lower(coalesce(t.name_en, '')) <> 'tbd'
ON CONFLICT (competition_id, team_id) DO NOTHING;

-- 6. teams.group_name ya no la lee nadie desde V44: el grupo es de la participacion. Antes de retirarla se
--    recoge el grupo de algun equipo propio que la version anterior pudiera haber creado durante su despliegue.
INSERT INTO competition_teams (competition_id, team_id, group_name)
SELECT t.competition_id, t.id, nullif(trim(t.group_name), '')
FROM teams t
WHERE t.competition_id IS NOT NULL
ON CONFLICT (competition_id, team_id) DO NOTHING;

ALTER TABLE teams DROP COLUMN group_name;
