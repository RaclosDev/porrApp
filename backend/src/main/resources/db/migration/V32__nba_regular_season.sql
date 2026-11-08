-- La temporada regular de la NBA como competición oficial: se pronostica partido a partido, por semanas
-- oficiales de la NBA, con datos de ESPN. Los playoffs siguen en su propia competición («nba»), serie a
-- serie, y se renombran para que el asistente de crear liga distinga las dos.
INSERT INTO competitions (name, external_id, format_type) VALUES ('NBA · Temporada regular', 'nba.regular', 'LEAGUE')
ON CONFLICT (external_id) DO NOTHING;

UPDATE competitions SET name = 'NBA · Playoffs' WHERE external_id = 'nba' AND name = 'NBA';
