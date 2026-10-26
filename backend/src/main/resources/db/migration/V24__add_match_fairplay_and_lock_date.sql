-- V24: Add home_fair_play and away_fair_play to matches table, and set default lock_date for World Cup editions
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_fair_play INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_fair_play INTEGER DEFAULT 0;

UPDATE editions SET lock_date = '2026-06-11 20:00:00' WHERE lock_date IS NULL;
