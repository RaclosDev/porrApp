-- Avisos push: cada dispositivo en el que el usuario aceptó recibir notificaciones.
CREATE TABLE push_subscriptions (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    endpoint    TEXT         NOT NULL UNIQUE,
    p256dh      VARCHAR(255) NOT NULL,
    auth        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Recordatorio ya enviado a un usuario por un partido sin predicción, para no repetirlo.
CREATE TABLE match_reminders_sent (
    user_id   BIGINT    NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    match_id  BIGINT    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sent_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, match_id)
);

-- Los recordatorios vienen activados; el usuario solo tiene que dar permiso en su dispositivo.
ALTER TABLE app_users ADD COLUMN match_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;
