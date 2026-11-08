-- La importación nocturna del calendario cambió el nombre de las selecciones por el del proveedor
-- («España» → «Spain»). Los cuadros de la porra guardan los nombres en español y se puntúan
-- comparándolos con el del equipo: se devuelven los nombres en español y se recalculan los puntos.
WITH names(name_en, name_es) AS (VALUES
    ('Mexico', 'México'), ('South Africa', 'Sudáfrica'), ('South Korea', 'Corea del Sur'),
    ('Czech Republic', 'Chequia'), ('Czechia', 'Chequia'), ('Canada', 'Canadá'),
    ('Bosnia and Herzegovina', 'Bosnia y Her.'), ('Bosnia-Herzegovina', 'Bosnia y Her.'),
    ('Qatar', 'Catar'), ('Switzerland', 'Suiza'), ('Brazil', 'Brasil'), ('Morocco', 'Marruecos'),
    ('Haiti', 'Haití'), ('Scotland', 'Escocia'), ('United States', 'EEUU'), ('USA', 'EEUU'),
    ('Turkey', 'Turquía'), ('Turkiye', 'Turquía'), ('Türkiye', 'Turquía'), ('Germany', 'Alemania'),
    ('Curacao', 'Curaçao'), ('Ivory Coast', 'Costa de Marfil'), ('Netherlands', 'Países Bajos'),
    ('Japan', 'Japón'), ('Sweden', 'Suecia'), ('Tunisia', 'Túnez'), ('Belgium', 'Bélgica'),
    ('Egypt', 'Egipto'), ('Iran', 'Irán'), ('New Zealand', 'Nueva Zelanda'), ('Spain', 'España'),
    ('Cape Verde', 'Cabo Verde'), ('Saudi Arabia', 'Arabia Saudí'), ('France', 'Francia'),
    ('Iraq', 'Irak'), ('Norway', 'Noruega'), ('Algeria', 'Argelia'), ('Jordan', 'Jordania'),
    ('DR Congo', 'RD Congo'), ('Congo DR', 'RD Congo'), ('Democratic Republic of the Congo', 'RD Congo'),
    ('Uzbekistan', 'Uzbekistán'), ('England', 'Inglaterra'), ('Croatia', 'Croacia'), ('Panama', 'Panamá')
)
UPDATE teams t
SET name = n.name_es
FROM names n
WHERE t.competition_id IS NULL
  AND t.name = n.name_en
  AND NOT EXISTS (SELECT 1 FROM teams other WHERE other.competition_id IS NULL AND other.name = n.name_es);

-- Los puntos guardados se calcularon con los nombres en inglés: se recalculan en la siguiente consulta.
UPDATE predictions SET score_calculated_at = NULL WHERE score_calculated_at IS NOT NULL;
