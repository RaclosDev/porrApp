-- Una competicion personalizada guarda el deporte elegido al crearla: hasta ahora todas se jugaban como
-- el futbol, con empate. Null en las oficiales (su deporte sale del id externo) y en las ya creadas.
ALTER TABLE competitions ADD COLUMN sport varchar(30);
