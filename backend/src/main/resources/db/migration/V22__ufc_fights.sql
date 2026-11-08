-- UFC: cada pelea es un partido (los luchadores, como equipos) con sus datos de pelea aquí. La ronda del
-- partido es el nombre de la velada. Las predicciones de una pelea guardan el ganador en prediction_sign
-- ('1' o '2') y, si se eligen, el método y el asalto.

CREATE TABLE fights (
    match_id bigint NOT NULL,
    event_external_id varchar(50) NOT NULL,
    card_segment varchar(20),
    bout_order integer,
    weight_class varchar(60),
    scheduled_rounds integer,
    home_record varchar(20),
    away_record varchar(20),
    result_method varchar(20),
    result_detail varchar(100),
    result_round integer,
    result_clock varchar(10),
    CONSTRAINT fights_pkey PRIMARY KEY (match_id),
    CONSTRAINT fights_match_fkey FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
);
CREATE INDEX idx_fights_event ON fights (event_external_id);

ALTER TABLE pronosticos_partido ADD COLUMN predicted_method varchar(20);
ALTER TABLE pronosticos_partido ADD COLUMN predicted_round integer;
ALTER TABLE pronosticos_partido ADD CONSTRAINT pronosticos_partido_predicted_round_check
    CHECK (predicted_round IS NULL OR predicted_round BETWEEN 1 AND 5);
