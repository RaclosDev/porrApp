-- Las ligas buscan su edición activa por liga y estado en cada petición.
CREATE INDEX IF NOT EXISTS idx_editions_league_status ON editions (league_id, status);
