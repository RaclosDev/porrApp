-- V28: Añadir restricción de unicidad para evitar duplicados concurrentes en predicciones
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_predictions_user_edition'
    ) THEN
        ALTER TABLE predictions ADD CONSTRAINT uq_predictions_user_edition UNIQUE (user_id, edition_id);
    END IF;
END $$;
