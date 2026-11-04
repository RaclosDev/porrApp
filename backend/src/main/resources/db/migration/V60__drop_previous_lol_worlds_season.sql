-- La sincronización de Worlds repasó el calendario entero de lolesports, que incluye la edición
-- anterior, y añadió sus cruces (cuartos, semis y final de 2025) al cuadro de la actual.
DELETE FROM matches
WHERE match_date < TIMESTAMP '2026-01-01 00:00:00'
  AND competition_id IN (SELECT id FROM competitions WHERE external_id = 'lol.worlds');
