-- Una liga pública se puede consultar sin ser miembro. Sustituye al trato especial de la
-- antigua Porra Global (código GLOBAL), que pasa a ser una liga más con esta marca.
ALTER TABLE leagues ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE leagues SET is_public = TRUE WHERE UPPER(join_code) = 'GLOBAL';
