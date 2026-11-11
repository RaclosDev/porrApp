ALTER TABLE score_games ADD COLUMN target_wins integer;
ALTER TABLE score_games ADD CONSTRAINT score_games_target_wins_check
    CHECK (target_wins IS NULL OR (target_wins BETWEEN 1 AND 500 AND mode IN ('WINS', 'ROUNDS')));
