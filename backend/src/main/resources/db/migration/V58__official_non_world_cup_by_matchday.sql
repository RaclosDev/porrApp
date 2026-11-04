-- El cuadro (grupos, terceros y cruces) solo existe para el Mundial de fútbol. Las demás
-- competiciones oficiales se juegan por jornadas: Worlds de LoL se sembró como torneo y las ligas
-- creadas con formato de cuadro sobre ellas mostraban el cuadro del Mundial.
UPDATE competitions
SET format_type = 'LEAGUE'
WHERE external_id = 'lol.worlds';

UPDATE editions
SET pool_format = 'MATCH_DAY', lock_date = NULL
WHERE pool_format <> 'MATCH_DAY'
  AND competition_id IN (
      SELECT id FROM competitions
      WHERE owner_league_id IS NULL
        AND external_id IS NOT NULL
        AND external_id <> 'fifa.world');
