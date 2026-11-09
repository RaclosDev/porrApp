-- Los equipos de una competicion propia tambien guardaban su grupo en teams.group_name. Cada uno pasa a
-- tener su participacion en competition_teams, con el grupo si lo tiene: el grupo es de la participacion,
-- no del equipo, igual que en los torneos oficiales (V40). La columna teams.group_name deja de leerse y
-- se retirara en una migracion posterior, cuando ninguna version desplegada la use.
INSERT INTO competition_teams (competition_id, team_id, group_name)
SELECT t.competition_id, t.id, nullif(trim(t.group_name), '')
FROM teams t
WHERE t.competition_id IS NOT NULL
ON CONFLICT (competition_id, team_id) DO NOTHING;
