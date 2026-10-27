-- V15__add_is_official_to_bets.sql
ALTER TABLE bets_v2 ADD COLUMN is_official BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE bets_v2 SET is_official = TRUE WHERE bet_name = 'official';

CREATE INDEX idx_bets_v2_is_official ON bets_v2(is_official);
