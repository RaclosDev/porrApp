UPDATE predictions SET score_calculated_at = NULL
WHERE edition_id IN (SELECT id FROM editions WHERE pichichi = FALSE);
