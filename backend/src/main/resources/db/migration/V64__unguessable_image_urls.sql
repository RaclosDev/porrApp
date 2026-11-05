-- Las fotos de perfil y las imágenes de liga se sirven en una URL con una clave aleatoria,
-- así no se pueden recorrer por id. Cada subida genera una clave nueva.
ALTER TABLE app_users ADD COLUMN avatar_key VARCHAR(32);
ALTER TABLE leagues ADD COLUMN image_key VARCHAR(32);
UPDATE app_users SET avatar_key = replace(gen_random_uuid()::text, '-', '') WHERE avatar_updated_at IS NOT NULL;
UPDATE leagues SET image_key = replace(gen_random_uuid()::text, '-', '') WHERE image_updated_at IS NOT NULL;
