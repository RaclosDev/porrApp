-- Reparación defensiva del esquema de imágenes de perfil y ligas.
-- V38 pudo quedar registrada en bases existentes antes de que se añadieran estas columnas.
-- No modifica datos y es segura tanto si las columnas existen como si faltan.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP;
