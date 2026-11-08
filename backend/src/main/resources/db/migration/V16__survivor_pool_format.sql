-- Modo superviviente (PoolFormat.SURVIVOR): cada jornada se elige un equipo que gane, sin repetirlo,
-- y quien falla queda eliminado. Las elecciones se guardan como predicciones de partido con signo 1 o 2.

ALTER TABLE editions DROP CONSTRAINT editions_bet_mode_check;
ALTER TABLE editions ADD CONSTRAINT editions_bet_mode_check
    CHECK (pool_format IN ('FULL_BRACKET', 'KNOCKOUTS_ONLY', 'MATCH_DAY', 'SURVIVOR'));

-- Eliminado en una liga superviviente; se guarda junto a los puntos materializados de la porra.
ALTER TABLE predictions ADD COLUMN survivor_eliminated boolean DEFAULT false NOT NULL;
