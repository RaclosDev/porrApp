-- Repetir liga: al terminar la temporada de una liga, su administrador crea otra para la temporada nueva
-- con los mismos miembros y ajustes. previous_league_id apunta de la liga nueva a la que repite; una liga
-- solo se repite una vez (si la nueva se borra, se puede volver a repetir).
ALTER TABLE leagues ADD COLUMN previous_league_id bigint REFERENCES leagues (id) ON DELETE SET NULL;
CREATE UNIQUE INDEX uq_leagues_previous_league ON leagues (previous_league_id)
    WHERE previous_league_id IS NOT NULL;
