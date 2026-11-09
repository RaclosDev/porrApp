-- Un equipo juega varias competiciones, y en cada torneo con fase de grupos cae en un grupo distinto:
-- el grupo es de su participacion en el torneo, no del equipo. Hasta ahora vivia en teams.group_name,
-- donde solo cabia un torneo.
CREATE TABLE competition_teams (
    id bigserial PRIMARY KEY,
    competition_id bigint NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
    team_id bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    group_name varchar(50),
    CONSTRAINT competition_teams_competition_team_key UNIQUE (competition_id, team_id)
);

CREATE INDEX idx_competition_teams_team ON competition_teams (team_id);

-- Las selecciones del Mundial 2026 eran los equipos sin competicion con letra de grupo A-L.
INSERT INTO competition_teams (competition_id, team_id, group_name)
SELECT c.id, t.id, upper(trim(t.group_name))
FROM teams t
JOIN competitions c ON c.external_id = 'fifa.world' AND c.owner_league_id IS NULL
WHERE t.competition_id IS NULL
  AND trim(t.group_name) ~ '^[A-La-l]$'
  AND lower(t.name) NOT IN ('por definir', 'tbd');
