-- Aviso push a los miembros de una liga cuando se une alguien nuevo; activado por defecto.
ALTER TABLE app_users ADD COLUMN member_joined_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
