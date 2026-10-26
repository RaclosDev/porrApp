-- V26__add_performance_indexes_and_materialized_scores.sql
-- Optimización de índices, persistencia de posiciones de grupos y materialización de puntuaciones

-- 1. Añadir position y status a group_standings
ALTER TABLE group_standings ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE group_standings ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 0;

-- 2. Añadir columnas de puntuación materializada a predictions
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS r1_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS r32_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS r16_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS qf_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS sf_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS finals_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS scorer_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS match_points INTEGER DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMP;

-- 3. Índices en group_standings
CREATE INDEX IF NOT EXISTS idx_group_standings_group_pos ON group_standings(group_name, position);
CREATE INDEX IF NOT EXISTS idx_group_standings_pos_pts ON group_standings(position, points DESC, goal_diff DESC, goals_for DESC, fair_play_points DESC);

-- 4. Índices en matches
CREATE INDEX IF NOT EXISTS idx_matches_comp_round_finished ON matches(competition_id, round, finished);
CREATE INDEX IF NOT EXISTS idx_matches_group_name ON matches(group_name);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);

-- 5. Índices en predictions
CREATE INDEX IF NOT EXISTS idx_predictions_edition_payment ON predictions(edition_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_edition_total_pts ON predictions(edition_id, total_points DESC);

-- 6. Índices en pronósticos de fase de grupos, cuadro y extras
CREATE INDEX IF NOT EXISTS idx_pronosticos_grupo_pred_group ON pronosticos_grupo(prediction_id, group_name);
CREATE INDEX IF NOT EXISTS idx_pronosticos_cuadro_pred_phase ON pronosticos_cuadro(prediction_id, phase);
CREATE INDEX IF NOT EXISTS idx_pronosticos_extra_pred ON pronosticos_extra(prediction_id);
