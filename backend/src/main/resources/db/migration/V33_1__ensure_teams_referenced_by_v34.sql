-- V33.1: equipos que V34 referencia por id.
--
-- V34 importó jornadas de LaLiga con los ids que esos equipos tenían en producción (50-69), donde
-- ya existían porque los había creado la sincronización. En una base nueva no existen y V34 falla
-- por clave foránea. Esta migración los crea solo si faltan, así que en producción no cambia nada.
-- Se aplica fuera de orden en las bases que ya están por encima de V34 (spring.flyway.out-of-order).
INSERT INTO teams (id, name)
SELECT g, 'Equipo LaLiga ' || g
FROM generate_series(50, 69) AS g
WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = g)
ON CONFLICT DO NOTHING;

-- Los ids se han fijado a mano: la secuencia no debe volver a repartirlos.
SELECT setval(
    pg_get_serial_sequence('teams', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM teams),
             COALESCE(pg_sequence_last_value(pg_get_serial_sequence('teams', 'id')::regclass), 1)));
