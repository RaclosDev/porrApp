-- Una liga de póker puede tener varios torneos programados a la vez.
DROP INDEX IF EXISTS uq_poker_session_open;
CREATE INDEX idx_poker_sessions_open ON poker_sessions (league_id, scheduled_on, id) WHERE closed_at IS NULL;
