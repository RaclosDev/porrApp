CREATE TABLE score_tracker_round_changes (
    id bigserial PRIMARY KEY,
    league_id bigint NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
    round_id bigint NOT NULL,
    actor_user_id bigint REFERENCES app_users (id) ON DELETE SET NULL,
    action varchar(10) NOT NULL,
    before_state text,
    after_state text,
    changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_round_changes_round ON score_tracker_round_changes (league_id, round_id, id);
