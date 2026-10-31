-- Conserva marcadores, aciertos y reglas configuradas; solo cambia los puntos concedidos.
WITH rescored AS (
    SELECT mp.id,
           CASE WHEN
               CASE
                   WHEN mp.home_score IS NOT NULL AND mp.away_score IS NOT NULL THEN
                       CASE WHEN mp.home_score > mp.away_score THEN '1'
                            WHEN mp.home_score = mp.away_score THEN 'X' ELSE '2' END
                   WHEN mp.home_score IS NULL AND mp.away_score IS NULL THEN mp.prediction_sign
               END = CASE WHEN m.home_score > m.away_score THEN '1'
                          WHEN m.home_score = m.away_score THEN 'X' ELSE '2' END
           THEN COALESCE((NULLIF(e.scoring_rules_json, '')::jsonb ->> 'correctSignPoints')::integer, 3)
           ELSE 0 END AS points
    FROM pronosticos_partido mp
    JOIN matches m ON m.id = mp.match_id
    JOIN predictions p ON p.id = mp.prediction_id
    JOIN editions e ON e.id = p.edition_id
    WHERE m.finished = TRUE AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
)
UPDATE pronosticos_partido mp
SET points_awarded = r.points,
    scoring_details = CASE WHEN r.points > 0 THEN 'Acierto de signo 1X2 (' || r.points || ' pts)'
                           ELSE 'Sin puntos por signo 1X2 (0 pts)' END
FROM rescored r WHERE mp.id = r.id;

UPDATE predictions SET score_calculated_at = NULL
WHERE id IN (SELECT prediction_id FROM pronosticos_partido);
