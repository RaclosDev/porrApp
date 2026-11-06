-- Elimina lo que ningún código usa:
-- - app_users.profile_image_data y leagues.image_data: restos de cuando las imágenes se guardaban en la fila;
--   solo existen en producción (vacías) y las imágenes viven en user_avatars y league_images.
-- - scoring_rule_sets: las reglas salen del código y de editions.scoring_rules_json.

ALTER TABLE app_users DROP COLUMN IF EXISTS profile_image_data;
ALTER TABLE leagues DROP COLUMN IF EXISTS image_data;
DROP TABLE scoring_rule_sets;
