-- Imágenes de liga y fotos de perfil.
-- Los bytes viven en tablas aparte para no cargarlos al leer ligas o usuarios.
ALTER TABLE leagues   ADD COLUMN IF NOT EXISTS image_updated_at  TIMESTAMP;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS league_images (
    league_id    BIGINT       PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
    content_type VARCHAR(50)  NOT NULL,
    data         BYTEA        NOT NULL,
    size_bytes   INTEGER      NOT NULL,
    updated_at   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_avatars (
    user_id      BIGINT       PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    content_type VARCHAR(50)  NOT NULL,
    data         BYTEA        NOT NULL,
    size_bytes   INTEGER      NOT NULL,
    updated_at   TIMESTAMP    NOT NULL DEFAULT now()
);
