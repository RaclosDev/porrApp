ALTER TABLE competitions ADD COLUMN owner_league_id BIGINT REFERENCES leagues(id);
CREATE UNIQUE INDEX uq_competitions_owner_league ON competitions(owner_league_id) WHERE owner_league_id IS NOT NULL;

ALTER TABLE teams ADD COLUMN competition_id BIGINT REFERENCES competitions(id);
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key;
CREATE UNIQUE INDEX uq_teams_custom_competition_name ON teams(competition_id, lower(name)) WHERE competition_id IS NOT NULL;
CREATE UNIQUE INDEX uq_teams_catalog_name ON teams(name) WHERE competition_id IS NULL;
