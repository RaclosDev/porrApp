-- Aviso push al terminar una jornada: preferencia de cada usuario y jornadas ya avisadas por edición,
-- para no repetir el aviso (MatchdayFinishedNotifier).

ALTER TABLE app_users ADD COLUMN matchday_finished_alerts_enabled boolean DEFAULT true NOT NULL;

CREATE TABLE matchday_finished_notices (
    edition_id bigint NOT NULL,
    matchday varchar(255) NOT NULL,
    sent_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT matchday_finished_notices_pkey PRIMARY KEY (edition_id, matchday),
    CONSTRAINT matchday_finished_notices_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES editions (id) ON DELETE CASCADE
);
