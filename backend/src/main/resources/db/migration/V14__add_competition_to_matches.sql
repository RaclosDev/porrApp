-- V14__add_competition_to_matches.sql
-- Ensure default competition exists
INSERT INTO competitions (name, external_id)
SELECT 'FIFA World Cup 2026', 'fifa.world'
WHERE NOT EXISTS (SELECT 1 FROM competitions);

ALTER TABLE matches ADD COLUMN competition_id BIGINT;
ALTER TABLE matches ADD CONSTRAINT fk_match_competition FOREIGN KEY (competition_id) REFERENCES competitions(id);

UPDATE matches SET competition_id = (SELECT id FROM competitions ORDER BY id ASC LIMIT 1) WHERE competition_id IS NULL;

CREATE INDEX idx_matches_competition_id ON matches(competition_id);
