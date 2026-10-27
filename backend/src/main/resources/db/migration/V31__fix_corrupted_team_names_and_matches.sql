-- V31: Normalizar y reparar nombres de equipos con posibles caracteres corruptos (mojibake)
UPDATE teams SET name = 'España' WHERE (name LIKE 'Espa%a' OR name = 'Espa??a' OR name = 'Espaa') AND name <> 'España';
UPDATE teams SET name = 'México' WHERE (name LIKE 'M%xico' OR name = 'M??xico') AND name <> 'México';
UPDATE teams SET name = 'Sudáfrica' WHERE (name LIKE 'Sud%frica' OR name = 'Sud??frica') AND name <> 'Sudáfrica';
UPDATE teams SET name = 'Canadá' WHERE (name LIKE 'Canad%' OR name = 'Canad??') AND name <> 'Canadá' AND name <> 'Canada';
UPDATE teams SET name = 'Haití' WHERE (name LIKE 'Hait%' OR name = 'Hait??') AND name <> 'Haití' AND name <> 'Haiti';
UPDATE teams SET name = 'Turquía' WHERE (name LIKE 'Turqu%' OR name = 'Turqu??') AND name <> 'Turquía' AND name <> 'Turkey';
UPDATE teams SET name = 'Curaçao' WHERE (name LIKE 'Cura%ao' OR name = 'Cura??ao' OR name = 'Curazao') AND name <> 'Curaçao';
UPDATE teams SET name = 'Países Bajos' WHERE (name LIKE 'Pa%ses Bajos' OR name = 'Pa??ses Bajos') AND name <> 'Países Bajos';
UPDATE teams SET name = 'Japón' WHERE (name LIKE 'Jap%n' OR name = 'Jap??n') AND name <> 'Japón' AND name <> 'Japan';
UPDATE teams SET name = 'Túnez' WHERE (name LIKE 'T%nez' OR name = 'T??nez') AND name <> 'Túnez' AND name <> 'Tunisia';
UPDATE teams SET name = 'Bélgica' WHERE (name LIKE 'B%lgica' OR name = 'B??lgica') AND name <> 'Bélgica';
UPDATE teams SET name = 'Irán' WHERE (name LIKE 'Ir%n' OR name = 'Ir??n') AND name <> 'Irán' AND name <> 'Iran';
UPDATE teams SET name = 'Arabia Saudí' WHERE (name LIKE 'Arabia Saud%' OR name = 'Arabia Saud??') AND name <> 'Arabia Saudí';
UPDATE teams SET name = 'Panamá' WHERE (name LIKE 'Panam%' OR name = 'Panam??') AND name <> 'Panamá' AND name <> 'Panama';
UPDATE teams SET name = 'Uzbekistán' WHERE (name LIKE 'Uzbekist%n' OR name = 'Uzbekist??n') AND name <> 'Uzbekistán';
