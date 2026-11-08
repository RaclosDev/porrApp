-- Iniciar sesión con Apple: claim "sub" del ID token de Apple, estable para cada cuenta de Apple.
-- Null en las cuentas que nunca han entrado con Apple.
ALTER TABLE app_users ADD COLUMN apple_sub varchar(255);
ALTER TABLE app_users ADD CONSTRAINT app_users_apple_sub_key UNIQUE (apple_sub);
