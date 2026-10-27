-- Align matches competition_id with active edition of the primary league
UPDATE matches 
SET competition_id = (SELECT competition_id FROM editions WHERE league_id = 1 LIMIT 1)
WHERE (SELECT competition_id FROM editions WHERE league_id = 1 LIMIT 1) IS NOT NULL;
