-- El único pichichi oficial es el del cuadro del Mundial. Las ediciones de otras competiciones o
-- por jornadas lo tenían marcado porque la columna lo activaba por defecto; ya no puntuaba en ellas.
UPDATE editions e
SET pichichi = false
WHERE e.pichichi
  AND (e.pool_format NOT IN ('FULL_BRACKET', 'KNOCKOUTS_ONLY')
       OR NOT EXISTS (SELECT 1 FROM competitions c WHERE c.id = e.competition_id AND c.external_id = 'fifa.world'));

ALTER TABLE editions ALTER COLUMN pichichi SET DEFAULT false;
