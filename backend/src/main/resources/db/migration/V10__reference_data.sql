-- Datos de referencia de una base nueva: competiciones oficiales y reglas del Mundial 2026.
-- El Mundial va primero para conservar el id 1.

INSERT INTO competitions (name, external_id, format_type) VALUES
    ('FIFA World Cup 2026', 'fifa.world', 'TOURNAMENT'),
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
    ('MLS', 'usa.1', 'LEAGUE');

INSERT INTO scoring_rule_sets (name, rules_json) VALUES (
    'World Cup 2026 Official',
    '{"groupQualifierPoints":10,"groupExactPositionPoints":10,"roundOf32Points":25,"roundOf16Points":30,"quarterFinalPoints":40,"semiFinalPoints":60,"championPoints":200,"runnerUpPoints":150,"thirdPlacePoints":100,"fourthPlacePoints":75,"topScorerPoints":100,"exactScorePoints":3,"correctSignPoints":1,"goalDiffBonusPoints":1}'
);
