ALTER TABLE matches ADD COLUMN winner_team_id BIGINT;
ALTER TABLE matches ADD CONSTRAINT fk_match_winner FOREIGN KEY (winner_team_id) REFERENCES teams(id);
