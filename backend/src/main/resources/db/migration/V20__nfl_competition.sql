-- La NFL como competición oficial: se pronostica semana a semana (Week 1-18) y en los playoffs hasta
-- la Super Bowl, con datos de ESPN. Equipos y calendario llegan con la importación.
INSERT INTO competitions (name, external_id, format_type) VALUES ('NFL', 'nfl', 'LEAGUE')
ON CONFLICT (external_id) DO NOTHING;
