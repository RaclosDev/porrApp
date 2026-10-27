-- V30: Add bracket_data to predictions and drop fragmented child tables
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS bracket_data TEXT;

-- Drop legacy child prediction tables superseded by structured bracket_data
DROP TABLE IF EXISTS pronosticos_cuadro CASCADE;
DROP TABLE IF EXISTS pronosticos_grupo CASCADE;
DROP TABLE IF EXISTS pronosticos_extra CASCADE;
DROP TABLE IF EXISTS prediction_backups CASCADE;
