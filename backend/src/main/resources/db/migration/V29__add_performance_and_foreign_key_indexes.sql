-- V29__add_performance_and_foreign_key_indexes.sql
-- Optimización de búsquedas por liga, partidos por competición y pronósticos por partido

CREATE INDEX IF NOT EXISTS idx_memberships_league_id ON memberships(league_id);
CREATE INDEX IF NOT EXISTS idx_pronosticos_partido_match_id ON pronosticos_partido(match_id);
CREATE INDEX IF NOT EXISTS idx_pronosticos_partido_pred_match ON pronosticos_partido(prediction_id, match_id);
CREATE INDEX IF NOT EXISTS idx_matches_comp_date ON matches(competition_id, match_date ASC);
CREATE INDEX IF NOT EXISTS idx_app_users_google_email ON app_users(google_email);
