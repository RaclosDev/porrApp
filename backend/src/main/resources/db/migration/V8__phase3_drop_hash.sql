-- Phase 3: Eliminamos la columna "hash" que contenía el payload legacy JSON en Base64.
-- A partir de ahora, todas las interacciones con el estado de la porra y cálculo de puntos 
-- serán mediante el esquema relacional puramente.

ALTER TABLE bets_v2
DROP COLUMN IF EXISTS hash;

ALTER TABLE bet_backups
DROP COLUMN IF EXISTS hash;
