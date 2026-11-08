-- Series al mejor de N (League of Legends): 1, 3 o 5 partidas. Con ellas se ofrece predecir el resultado
-- de la serie (2-1, 3-0) y se dice en cada partido. Nulo en los deportes sin series.
ALTER TABLE matches ADD COLUMN best_of SMALLINT;
