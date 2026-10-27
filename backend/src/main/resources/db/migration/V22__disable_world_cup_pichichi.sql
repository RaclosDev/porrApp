-- V22: Disable Pichichi and Fair Play tiebreakers for World Cup editions
UPDATE editions
SET pichichi = FALSE
WHERE competition_id IN (
    SELECT id FROM competitions WHERE name ILIKE '%Mundial%' OR name ILIKE '%World%'
) OR league_id = 1;
