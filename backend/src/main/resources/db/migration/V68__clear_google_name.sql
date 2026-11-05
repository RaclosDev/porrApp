-- Minimización (RGPD): el nombre de Google solo servía para proponer el apodo inicial.
-- Ya no se guarda; se borra el que había.
ALTER TABLE app_users ALTER COLUMN google_name DROP NOT NULL;
UPDATE app_users SET google_name = NULL WHERE google_name IS NOT NULL;
