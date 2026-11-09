-- La clasificación de grupos pasa a ser de una competición: hasta ahora solo cabía una fase de
-- grupos en toda la aplicación, la del Mundial.

ALTER TABLE group_standings ADD COLUMN competition_id bigint;

-- Todas las filas que había son del Mundial.
UPDATE group_standings
SET competition_id = (SELECT id FROM competitions WHERE external_id = 'fifa.world');

-- Sin torneo al que asignarlas no dicen nada; la clasificación se recalcula con los partidos.
DELETE FROM group_standings WHERE competition_id IS NULL;

ALTER TABLE group_standings ALTER COLUMN competition_id SET NOT NULL;
ALTER TABLE group_standings ADD CONSTRAINT group_standings_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE;

-- El nombre del grupo, con el mismo tamaño que en partidos y equipos.
ALTER TABLE group_standings ALTER COLUMN group_name TYPE varchar(50);

DROP INDEX idx_group_standings_group_pos;
CREATE INDEX idx_group_standings_competition_group_pos
    ON group_standings (competition_id, group_name, "position");
