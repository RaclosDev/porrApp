-- Una fila de competitions es una temporada de la competicion. Al empezar la siguiente, la fila vieja se
-- archiva (con sus partidos, equipos, grupos y ligas) y se crea otra con el mismo id externo: por eso el
-- id externo solo es unico entre las filas vigentes. season es la etiqueta de la temporada ("2026/27",
-- "2026"); null mientras el proveedor no la haya dicho.
ALTER TABLE competitions ADD COLUMN season varchar(20);
ALTER TABLE competitions ADD COLUMN archived_at timestamptz;

ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_external_id_key;
CREATE UNIQUE INDEX uq_competitions_current_external_id ON competitions (external_id)
    WHERE archived_at IS NULL;
