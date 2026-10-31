-- V5 and V28 enforce the same pair. Keep the named constraint used by the application.
DO $$
DECLARE
    redundant RECORD;
BEGIN
    FOR redundant IN
        SELECT old.conname
        FROM pg_constraint old
        JOIN pg_constraint canonical
          ON canonical.conrelid = old.conrelid
         AND canonical.conkey = old.conkey
         AND canonical.contype = old.contype
        WHERE old.conrelid = 'predictions'::regclass
          AND old.contype = 'u'
          AND canonical.conname = 'uq_predictions_user_edition'
          AND old.conname <> canonical.conname
    LOOP
        EXECUTE format('ALTER TABLE predictions DROP CONSTRAINT %I', redundant.conname);
    END LOOP;
END $$;
