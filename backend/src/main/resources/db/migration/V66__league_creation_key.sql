-- Clave de idempotencia al crear una liga: el cliente la genera al abrir el formulario y,
-- si la petición se repite (doble clic, reintento de red), se devuelve la liga ya creada.
ALTER TABLE leagues ADD COLUMN creation_key VARCHAR(64);

CREATE UNIQUE INDEX uq_leagues_admin_creation_key
    ON leagues (admin_user_id, creation_key)
    WHERE creation_key IS NOT NULL;
