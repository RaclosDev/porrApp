-- Ligas por jornadas que juntan partidos de varias competiciones oficiales (un Clásico, un derbi de
-- la Premier y un partido de Champions). editions.competition_id sigue siendo la principal; en una
-- liga multicompetición, edition_competitions guarda todas (también la principal) y sus jornadas son
-- semanas de lunes a domingo, porque las jornadas de cada competición no coinciden entre sí.

ALTER TABLE editions ADD COLUMN multi_competition boolean DEFAULT false NOT NULL;

CREATE TABLE edition_competitions (
    edition_id bigint NOT NULL,
    competition_id bigint NOT NULL,
    CONSTRAINT edition_competitions_pkey PRIMARY KEY (edition_id, competition_id),
    CONSTRAINT edition_competitions_edition_fkey FOREIGN KEY (edition_id) REFERENCES editions (id) ON DELETE CASCADE,
    CONSTRAINT edition_competitions_competition_fkey FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE
);
CREATE INDEX idx_edition_competitions_competition ON edition_competitions (competition_id);
