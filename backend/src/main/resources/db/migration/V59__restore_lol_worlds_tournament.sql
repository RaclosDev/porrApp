-- Deshace V58 para Worlds: es un torneo (fase suiza y eliminatorias), no una liga por jornadas.
-- V58 se conserva porque ya se aplicó; las ligas de Worlds vuelven al formato de cuadro.
UPDATE competitions
SET format_type = 'TOURNAMENT'
WHERE external_id = 'lol.worlds';

UPDATE editions
SET pool_format = 'FULL_BRACKET'
WHERE pool_format = 'MATCH_DAY'
  AND competition_id IN (SELECT id FROM competitions WHERE external_id = 'lol.worlds');
