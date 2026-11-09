-- Registro e inicio de sesión con email y contraseña, para quien no quiere usar Google.
-- La cuenta usa google_email como email de acceso (el nombre de la columna es histórico) y aquí
-- guarda el hash BCrypt de la contraseña. Null en las cuentas de Google.
ALTER TABLE app_users ADD COLUMN password_hash varchar(100);
