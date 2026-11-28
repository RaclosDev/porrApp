-- Plan de cada liga (límites del póker) y música en la TV, que de momento solo tienen las ligas elegidas a mano.
ALTER TABLE leagues ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'FREE'
    CHECK (plan IN ('FREE', 'LIGA', 'CLUB', 'CUSTOM'));
ALTER TABLE leagues ADD COLUMN poker_music BOOLEAN NOT NULL DEFAULT FALSE;

-- Las ligas de póker que ya existían conservan lo que tenían: plan Liga y música.
UPDATE leagues SET plan = 'LIGA', poker_music = TRUE WHERE kind = 'POKER';
