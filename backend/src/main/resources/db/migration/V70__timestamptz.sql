-- Las fechas pasan a timestamptz: el instante deja de depender de la zona horaria del servidor.
-- Los valores guardados eran hora peninsular sin desfase, así que se interpretan en Europe/Madrid.
ALTER TABLE app_users
    ALTER COLUMN avatar_updated_at TYPE TIMESTAMPTZ USING avatar_updated_at AT TIME ZONE 'Europe/Madrid',
    ALTER COLUMN linked_at TYPE TIMESTAMPTZ USING linked_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE competitions
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE editions
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid',
    ALTER COLUMN lock_date TYPE TIMESTAMPTZ USING lock_date AT TIME ZONE 'Europe/Madrid';
ALTER TABLE league_images
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE leagues
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid',
    ALTER COLUMN image_updated_at TYPE TIMESTAMPTZ USING image_updated_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE match_reminders_sent
    ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE matches
    ALTER COLUMN match_date TYPE TIMESTAMPTZ USING match_date AT TIME ZONE 'Europe/Madrid';
ALTER TABLE memberships
    ALTER COLUMN joined_at TYPE TIMESTAMPTZ USING joined_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE predictions
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid',
    ALTER COLUMN score_calculated_at TYPE TIMESTAMPTZ USING score_calculated_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE pronosticos_partido
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid',
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE push_subscriptions
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE scoring_rule_sets
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Madrid';
ALTER TABLE user_avatars
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Europe/Madrid';
