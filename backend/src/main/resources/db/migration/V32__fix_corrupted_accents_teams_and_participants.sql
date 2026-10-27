-- V32__fix_corrupted_accents_teams_and_participants.sql
-- Reparación exhaustiva de caracteres corruptos (mojibake UTF-8 y '??') en equipos, participantes, ligas y pronósticos

-- 1. Reparar mojibake en app_users (participant_name y google_name)
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã¡', 'á') WHERE participant_name LIKE '%Ã¡%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã©', 'é') WHERE participant_name LIKE '%Ã©%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã­', 'í') WHERE participant_name LIKE '%Ã­%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã³', 'ó') WHERE participant_name LIKE '%Ã³%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ãº', 'ú') WHERE participant_name LIKE '%Ãº%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã±', 'ñ') WHERE participant_name LIKE '%Ã±%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã', 'Á') WHERE participant_name LIKE '%Ã%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã', 'É') WHERE participant_name LIKE '%Ã%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã', 'Í') WHERE participant_name LIKE '%Ã%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã', 'Ó') WHERE participant_name LIKE '%Ã%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã', 'Ú') WHERE participant_name LIKE '%Ã%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã', 'Ñ') WHERE participant_name LIKE '%Ã%';
UPDATE app_users SET participant_name = REPLACE(participant_name, 'Ã§', 'ç') WHERE participant_name LIKE '%Ã§%';

UPDATE app_users SET google_name = REPLACE(google_name, 'Ã¡', 'á') WHERE google_name LIKE '%Ã¡%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ã©', 'é') WHERE google_name LIKE '%Ã©%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ã­', 'í') WHERE google_name LIKE '%Ã­%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ã³', 'ó') WHERE google_name LIKE '%Ã³%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ãº', 'ú') WHERE google_name LIKE '%Ãº%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ã±', 'ñ') WHERE google_name LIKE '%Ã±%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ã', 'Á') WHERE google_name LIKE '%Ã%';
UPDATE app_users SET google_name = REPLACE(google_name, 'Ã', 'É') WHERE google_name LIKE '%Ã%';

-- Restaurar participant_name desde google_name cuando google_name sea válido y participant_name contenga '??'
UPDATE app_users
SET participant_name = google_name
WHERE (participant_name LIKE '%??%' OR participant_name LIKE '%\uFFFD%')
  AND google_name IS NOT NULL
  AND google_name NOT LIKE '%??%'
  AND google_name NOT LIKE '%\uFFFD%'
  AND google_name <> '';

-- Nombres propios comunes de participantes dañados con '??'
UPDATE app_users SET participant_name = 'Anónimo' WHERE participant_name IN ('An??nimo', 'An?nimo', 'Anonimo');
UPDATE app_users SET participant_name = 'Raúl' WHERE participant_name IN ('Ra??l', 'Ra?l');
UPDATE app_users SET participant_name = 'José' WHERE participant_name IN ('Jos??', 'Jos?');
UPDATE app_users SET participant_name = 'Adrián' WHERE participant_name IN ('Adri??n', 'Adri?n');
UPDATE app_users SET participant_name = 'Ángel' WHERE participant_name IN ('??ngel', '?ngel');
UPDATE app_users SET participant_name = 'Álvaro' WHERE participant_name IN ('??lvaro', '?lvaro');
UPDATE app_users SET participant_name = 'Óscar' WHERE participant_name IN ('??scar', '?scar');
UPDATE app_users SET participant_name = 'Iñaki' WHERE participant_name IN ('I??aki', 'I?aki');
UPDATE app_users SET participant_name = 'Rubén' WHERE participant_name IN ('Rub??n', 'Rub?n');
UPDATE app_users SET participant_name = 'Víctor' WHERE participant_name IN ('V??ctor', 'V?ctor');
UPDATE app_users SET participant_name = 'Jesús' WHERE participant_name IN ('Jes??s', 'Jes?s');
UPDATE app_users SET participant_name = 'Héctor' WHERE participant_name IN ('H??ctor', 'H?ctor');
UPDATE app_users SET participant_name = 'César' WHERE participant_name IN ('C??sar', 'C?sar');
UPDATE app_users SET participant_name = 'Félix' WHERE participant_name IN ('F??lix', 'F?lix');
UPDATE app_users SET participant_name = 'Andrés' WHERE participant_name IN ('Andr??s', 'Andr?s');
UPDATE app_users SET participant_name = 'Tomás' WHERE participant_name IN ('Tom??s', 'Tom?s');
UPDATE app_users SET participant_name = 'Matías' WHERE participant_name IN ('Mat??as', 'Mat?as');
UPDATE app_users SET participant_name = 'Nicolás' WHERE participant_name IN ('Nicol??s', 'Nicol?s');
UPDATE app_users SET participant_name = 'Agustín' WHERE participant_name IN ('Agust??n', 'Agust?n');
UPDATE app_users SET participant_name = 'Martín' WHERE participant_name IN ('Mart??n', 'Mart?n');
UPDATE app_users SET participant_name = 'Joaquín' WHERE participant_name IN ('Joaqu??n', 'Joaqu?n');
UPDATE app_users SET participant_name = 'Iván' WHERE participant_name IN ('Iv??n', 'Iv?n');
UPDATE app_users SET participant_name = 'Sebastián' WHERE participant_name IN ('Sebasti??n', 'Sebasti?n');
UPDATE app_users SET participant_name = 'González' WHERE participant_name IN ('Gonz??lez', 'Gonz?lez');
UPDATE app_users SET participant_name = 'Rodríguez' WHERE participant_name IN ('Rodr??guez', 'Rodr?guez');
UPDATE app_users SET participant_name = 'Fernández' WHERE participant_name IN ('Fern??ndez', 'Fern?ndez');
UPDATE app_users SET participant_name = 'López' WHERE participant_name IN ('L??pez', 'L?pez');
UPDATE app_users SET participant_name = 'Martínez' WHERE participant_name IN ('Mart??nez', 'Mart?nez');
UPDATE app_users SET participant_name = 'Sánchez' WHERE participant_name IN ('S??nchez', 'S?nchez');
UPDATE app_users SET participant_name = 'Pérez' WHERE participant_name IN ('P??rez', 'P?rez');
UPDATE app_users SET participant_name = 'Gómez' WHERE participant_name IN ('G??mez', 'G?mez');
UPDATE app_users SET participant_name = 'Díaz' WHERE participant_name IN ('D??az', 'D?az');
UPDATE app_users SET participant_name = 'Álvarez' WHERE participant_name IN ('??lvarez', '?lvarez');
UPDATE app_users SET participant_name = 'Muñoz' WHERE participant_name IN ('Mu??oz', 'Mu?oz');
UPDATE app_users SET participant_name = 'Núñez' WHERE participant_name IN ('N??ñez', 'N??ez', 'N?ñez');

-- 2. Equipos con mojibake o '??'
UPDATE teams SET name = 'España' WHERE (name LIKE 'Espa%a' OR name LIKE '%Espa??a%' OR name = 'Espaa') AND name <> 'España';
UPDATE teams SET name = 'México' WHERE (name LIKE 'M%xico' OR name LIKE '%M??xico%') AND name <> 'México';
UPDATE teams SET name = 'Sudáfrica' WHERE (name LIKE 'Sud%frica' OR name LIKE '%Sud??frica%') AND name <> 'Sudáfrica';
UPDATE teams SET name = 'Canadá' WHERE (name LIKE 'Canad%' OR name LIKE '%Canad??%') AND name <> 'Canadá' AND name <> 'Canada';
UPDATE teams SET name = 'Haití' WHERE (name LIKE 'Hait%' OR name LIKE '%Hait??%') AND name <> 'Haití' AND name <> 'Haiti';
UPDATE teams SET name = 'Turquía' WHERE (name LIKE 'Turqu%' OR name LIKE '%Turqu??%') AND name <> 'Turquía' AND name <> 'Turkey';
UPDATE teams SET name = 'Curaçao' WHERE (name LIKE 'Cura%ao' OR name LIKE '%Cura??ao%' OR name = 'Curazao') AND name <> 'Curaçao';
UPDATE teams SET name = 'Países Bajos' WHERE (name LIKE 'Pa%ses Bajos' OR name LIKE '%Pa??ses Bajos%') AND name <> 'Países Bajos';
UPDATE teams SET name = 'Japón' WHERE (name LIKE 'Jap%n' OR name LIKE '%Jap??n%') AND name <> 'Japón' AND name <> 'Japan';
UPDATE teams SET name = 'Túnez' WHERE (name LIKE 'T%nez' OR name LIKE '%T??nez%') AND name <> 'Túnez' AND name <> 'Tunisia';
UPDATE teams SET name = 'Bélgica' WHERE (name LIKE 'B%lgica' OR name LIKE '%B??lgica%') AND name <> 'Bélgica';
UPDATE teams SET name = 'Irán' WHERE (name LIKE 'Ir%n' OR name LIKE '%Ir??n%') AND name <> 'Irán' AND name <> 'Iran';
UPDATE teams SET name = 'Arabia Saudí' WHERE (name LIKE 'Arabia Saud%' OR name LIKE '%Saud??%' OR name LIKE '%SaudÃ­%') AND name <> 'Arabia Saudí';
UPDATE teams SET name = 'Panamá' WHERE (name LIKE 'Panam%' OR name LIKE '%Panam??%') AND name <> 'Panamá' AND name <> 'Panama';
UPDATE teams SET name = 'Uzbekistán' WHERE (name LIKE 'Uzbekist%n' OR name LIKE '%Uzbekist??%') AND name <> 'Uzbekistán' AND name <> 'Uzbekistan';
UPDATE teams SET name = 'Camerún' WHERE (name LIKE 'Camer%n' OR name LIKE '%Camer??%') AND name <> 'Camerún' AND name <> 'Cameroon';
UPDATE teams SET name = 'Atlético de Madrid' WHERE (name LIKE 'Atl%tico de Madrid' OR name LIKE '%Atl??tico%') AND name <> 'Atlético de Madrid';
UPDATE teams SET name = 'Alavés' WHERE (name LIKE 'Alav%s' OR name LIKE '%Alav??s%') AND name <> 'Alavés';
UPDATE teams SET name = 'Leganés' WHERE (name LIKE 'Legan%s' OR name LIKE '%Legan??s%') AND name <> 'Leganés';
UPDATE teams SET name = 'Cádiz' WHERE (name LIKE 'C%diz' OR name LIKE '%C??diz%') AND name <> 'Cádiz';
UPDATE teams SET name = 'Almería' WHERE (name LIKE 'Almer%a' OR name LIKE '%Almer??a%') AND name <> 'Almería';
UPDATE teams SET name = 'Málaga' WHERE (name LIKE 'M%laga' OR name LIKE '%M??laga%') AND name <> 'Málaga';
UPDATE teams SET name = 'La Coruña' WHERE (name LIKE 'La Coru%a' OR name LIKE '%La Coru??a%') AND name <> 'La Coruña';

-- 3. Ligas
UPDATE leagues SET name = REPLACE(name, 'Pe??a', 'Peña') WHERE name LIKE '%Pe??a%';
UPDATE leagues SET name = REPLACE(name, 'PeÃ±a', 'Peña') WHERE name LIKE '%PeÃ±a%';

-- 4. JSON bracket_data en predictions
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Espa??a', 'España') WHERE bracket_data LIKE '%Espa??a%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'EspaÃ±a', 'España') WHERE bracket_data LIKE '%EspaÃ±a%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'M??xico', 'México') WHERE bracket_data LIKE '%M??xico%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'MÃ©xico', 'México') WHERE bracket_data LIKE '%MÃ©xico%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Sud??frica', 'Sudáfrica') WHERE bracket_data LIKE '%Sud??frica%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'SudÃ¡frica', 'Sudáfrica') WHERE bracket_data LIKE '%SudÃ¡frica%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Canad??', 'Canadá') WHERE bracket_data LIKE '%Canad??%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'CanadÃ¡', 'Canadá') WHERE bracket_data LIKE '%CanadÃ¡%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Hait??', 'Haití') WHERE bracket_data LIKE '%Hait??%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'HaitÃ­', 'Haití') WHERE bracket_data LIKE '%HaitÃ­%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Turqu??a', 'Turquía') WHERE bracket_data LIKE '%Turqu??a%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'TurquÃ­a', 'Turquía') WHERE bracket_data LIKE '%TurquÃ­a%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Cura??ao', 'Curaçao') WHERE bracket_data LIKE '%Cura??ao%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'CuraÃ§ao', 'Curaçao') WHERE bracket_data LIKE '%CuraÃ§ao%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Pa??ses Bajos', 'Países Bajos') WHERE bracket_data LIKE '%Pa??ses Bajos%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'PaÃ­ses Bajos', 'Países Bajos') WHERE bracket_data LIKE '%PaÃ­ses Bajos%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Jap??n', 'Japón') WHERE bracket_data LIKE '%Jap??n%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'JapÃ³n', 'Japón') WHERE bracket_data LIKE '%JapÃ³n%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'T??nez', 'Túnez') WHERE bracket_data LIKE '%T??nez%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'TÃºnez', 'Túnez') WHERE bracket_data LIKE '%TÃºnez%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'B??lgica', 'Bélgica') WHERE bracket_data LIKE '%B??lgica%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'BÃ©lgica', 'Bélgica') WHERE bracket_data LIKE '%BÃ©lgica%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Ir??n', 'Irán') WHERE bracket_data LIKE '%Ir??n%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'IrÃ¡n', 'Irán') WHERE bracket_data LIKE '%IrÃ¡n%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Arabia Saud??', 'Arabia Saudí') WHERE bracket_data LIKE '%Arabia Saud??%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Arabia SaudÃ­', 'Arabia Saudí') WHERE bracket_data LIKE '%Arabia SaudÃ­%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Panam??', 'Panamá') WHERE bracket_data LIKE '%Panam??%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'PanamÃ¡', 'Panamá') WHERE bracket_data LIKE '%PanamÃ¡%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'Uzbekist??n', 'Uzbekistán') WHERE bracket_data LIKE '%Uzbekist??n%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'UzbekistÃ¡n', 'Uzbekistán') WHERE bracket_data LIKE '%UzbekistÃ¡n%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'An??nimo', 'Anónimo') WHERE bracket_data LIKE '%An??nimo%';
UPDATE predictions SET bracket_data = REPLACE(bracket_data, 'AnÃ³nimo', 'Anónimo') WHERE bracket_data LIKE '%AnÃ³nimo%';
