ALTER TABLE score_tracker_rounds ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
