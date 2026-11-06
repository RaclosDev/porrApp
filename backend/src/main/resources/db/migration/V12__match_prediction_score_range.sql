-- Los marcadores pronosticados van de 0 a 99, como valida la API (MatchPredictionItemDTO).
-- NOT VALID: la restricción se aplica a las filas nuevas y modificadas sin revisar las existentes,
-- así la migración no puede fallar en producción por un dato antiguo.
ALTER TABLE pronosticos_partido
    ADD CONSTRAINT ck_pronosticos_partido_score_range
    CHECK ((home_score IS NULL OR home_score BETWEEN 0 AND 99)
       AND (away_score IS NULL OR away_score BETWEEN 0 AND 99)) NOT VALID;
