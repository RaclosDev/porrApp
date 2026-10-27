-- V28: Añadir restricción de unicidad para evitar duplicados concurrentes en predicciones
DELETE FROM predictions a USING predictions b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND a.edition_id = b.edition_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_predictions_user_edition'
    ) THEN
        ALTER TABLE predictions ADD CONSTRAINT uq_predictions_user_edition UNIQUE (user_id, edition_id);
    END IF;
END $$;
