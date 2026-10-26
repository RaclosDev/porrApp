-- V17__rename_bets_to_predictions.sql
-- Eliminacion definitiva de terminologia bet/apuesta a nivel de esquema de base de datos

ALTER TABLE bets_v2 RENAME TO predictions;
ALTER TABLE predictions RENAME COLUMN bet_name TO prediction_name;

ALTER TABLE bet_backups RENAME TO prediction_backups;
ALTER TABLE prediction_backups RENAME COLUMN original_bet_id TO original_prediction_id;
ALTER TABLE prediction_backups RENAME COLUMN bet_name TO prediction_name;

ALTER TABLE pronosticos_grupo RENAME COLUMN bet_id TO prediction_id;
ALTER TABLE pronosticos_cuadro RENAME COLUMN bet_id TO prediction_id;
ALTER TABLE pronosticos_extra RENAME COLUMN bet_id TO prediction_id;

ALTER TABLE editions RENAME COLUMN bet_mode TO pool_format;

ALTER INDEX IF EXISTS idx_bets_v2_is_official RENAME TO idx_predictions_is_official;
