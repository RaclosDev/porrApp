-- V21__add_format_and_seed_competitions.sql
-- Add format_type to competitions and logo_url to teams
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS format_type VARCHAR(30) DEFAULT 'LEAGUE';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Update existing FIFA World Cup competition if present
UPDATE competitions
SET format_type = 'TOURNAMENT', external_id = 'fifa.world'
WHERE name ILIKE '%World Cup%' OR name ILIKE '%Mundial%';

-- Ensure supported competitions are registered
INSERT INTO competitions (name, external_id, format_type)
VALUES
    ('LaLiga EA Sports', 'esp.1', 'LEAGUE'),
    ('UEFA Champions League', 'uefa.champions', 'LEAGUE'),
    ('Premier League', 'eng.1', 'LEAGUE'),
    ('Serie A', 'ita.1', 'LEAGUE'),
    ('Bundesliga', 'ger.1', 'LEAGUE'),
    ('Ligue 1', 'fra.1', 'LEAGUE'),
    ('Copa del Rey', 'esp.copa_del_rey', 'TOURNAMENT'),
    ('UEFA Europa League', 'uefa.europa', 'LEAGUE'),
    ('UEFA Conference League', 'uefa.europa.conf', 'LEAGUE'),
    ('Copa Libertadores', 'conmebol.libertadores', 'TOURNAMENT'),
    ('Liga BBVA MX', 'mex.1', 'LEAGUE'),
    ('MLS', 'usa.1', 'LEAGUE')
ON CONFLICT (external_id) DO UPDATE
SET name = EXCLUDED.name, format_type = EXCLUDED.format_type;
