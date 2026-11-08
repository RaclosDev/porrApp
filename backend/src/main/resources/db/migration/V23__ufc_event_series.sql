-- UFC: una liga con todas las veladas puede seguir solo las numeradas o solo las Fight Night. Nulo: todas.
ALTER TABLE editions ADD COLUMN event_series varchar(20);
ALTER TABLE editions ADD CONSTRAINT editions_event_series_check
    CHECK (event_series IS NULL OR event_series IN ('NUMBERED', 'FIGHT_NIGHT'));
