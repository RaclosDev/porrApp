-- Reconciliación defensiva del esquema de almacenamiento de imágenes.
-- V38 crea estas tablas, pero CREATE TABLE IF NOT EXISTS no repara tablas preexistentes
-- que tengan una estructura incompleta. Esta migración asegura las columnas que usan JPA.
CREATE TABLE IF NOT EXISTS user_avatars (
    user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    data BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_images (
    league_id BIGINT PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    data BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS content_type VARCHAR(50);
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE user_avatars ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

ALTER TABLE league_images ADD COLUMN IF NOT EXISTS league_id BIGINT;
ALTER TABLE league_images ADD COLUMN IF NOT EXISTS content_type VARCHAR(50);
ALTER TABLE league_images ADD COLUMN IF NOT EXISTS data BYTEA;
ALTER TABLE league_images ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE league_images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Completa valores de columnas nuevas o antiguas que puedan ser NULL antes de
-- imponer las restricciones requeridas por las entidades JPA.
UPDATE user_avatars
SET updated_at = COALESCE(updated_at, now()),
    content_type = COALESCE(content_type, 'image/jpeg'),
    data = COALESCE(data, decode('', 'hex')),
    size_bytes = COALESCE(size_bytes, 0)
WHERE updated_at IS NULL OR content_type IS NULL OR data IS NULL OR size_bytes IS NULL;

UPDATE league_images
SET updated_at = COALESCE(updated_at, now()),
    content_type = COALESCE(content_type, 'image/jpeg'),
    data = COALESCE(data, decode('', 'hex')),
    size_bytes = COALESCE(size_bytes, 0)
WHERE updated_at IS NULL OR content_type IS NULL OR data IS NULL OR size_bytes IS NULL;

ALTER TABLE user_avatars ALTER COLUMN content_type SET NOT NULL;
ALTER TABLE user_avatars ALTER COLUMN data SET NOT NULL;
ALTER TABLE user_avatars ALTER COLUMN size_bytes SET NOT NULL;
ALTER TABLE user_avatars ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE user_avatars ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE league_images ALTER COLUMN content_type SET NOT NULL;
ALTER TABLE league_images ALTER COLUMN data SET NOT NULL;
ALTER TABLE league_images ALTER COLUMN size_bytes SET NOT NULL;
ALTER TABLE league_images ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE league_images ALTER COLUMN updated_at SET NOT NULL;
