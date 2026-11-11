ALTER TABLE score_tracker_rounds
    ADD COLUMN client_request_id uuid,
    ADD COLUMN request_fingerprint varchar(64),
    ADD COLUMN revision integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX uq_score_round_client_request
    ON score_tracker_rounds (league_id, client_request_id)
    WHERE client_request_id IS NOT NULL;
