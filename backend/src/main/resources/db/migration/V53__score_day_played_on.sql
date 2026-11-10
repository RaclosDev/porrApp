ALTER TABLE score_days ADD COLUMN played_on date;
UPDATE score_days SET played_on = (started_at AT TIME ZONE 'Europe/Madrid')::date;
ALTER TABLE score_days ALTER COLUMN played_on SET NOT NULL;
CREATE INDEX idx_score_days_league_played_on ON score_days (league_id, played_on DESC);
