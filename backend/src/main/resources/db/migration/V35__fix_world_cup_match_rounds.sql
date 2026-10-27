-- V35: Arreglar la ronda de los partidos de fase de grupos que fueron asignados erróneamente como final o fases eliminatorias
UPDATE matches 
SET round = 'group' 
WHERE (group_name IS NOT NULL AND group_name <> '-' AND TRIM(group_name) <> '')
  AND (round = 'final' OR round = 'third' OR round = 'sf' OR round = 'qf' OR round = 'r16' OR round = 'r32');

-- Asegurar que partidos donde ambos equipos pertenecen al mismo grupo tengan round = 'group'
UPDATE matches 
SET round = 'group',
    group_name = (SELECT t1.group_name FROM teams t1 WHERE t1.id = matches.home_team_id)
WHERE competition_id = 1 
  AND (round = 'final' OR round = 'third' OR round = 'sf' OR round = 'qf' OR round = 'r16' OR round = 'r32')
  AND home_team_id IN (SELECT id FROM teams WHERE group_name IS NOT NULL AND group_name <> '-')
  AND away_team_id IN (SELECT id FROM teams WHERE group_name IS NOT NULL AND group_name <> '-')
  AND (SELECT t1.group_name FROM teams t1 WHERE t1.id = matches.home_team_id) = (SELECT t2.group_name FROM teams t2 WHERE t2.id = matches.away_team_id);
