-- UFC: título en juego en una pelea, tal como lo da ESPN («UFC Heavyweight Title», «UFC Interim Lightweight
-- Title»); nulo si no hay título. Y las tarjetas de los jueces de una decisión («30-27 | 29-28 | 30-27»).
ALTER TABLE fights ADD COLUMN title varchar(60);
ALTER TABLE fights ADD COLUMN judges_scores varchar(40);
