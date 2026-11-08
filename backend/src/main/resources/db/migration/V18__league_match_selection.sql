-- Partidos que entran en una liga por jornadas sobre una competición oficial. Con 'ALL' entran todos
-- (como hasta ahora) salvo los quitados a mano; con 'CUSTOM' entran los de los equipos seguidos y los
-- añadidos a mano, salvo los quitados. Los partidos futuros de un equipo seguido entran solos.

ALTER TABLE editions ADD COLUMN match_selection varchar(20) DEFAULT 'ALL' NOT NULL;
ALTER TABLE editions ADD CONSTRAINT editions_match_selection_check
    CHECK (match_selection IN ('ALL', 'CUSTOM'));

-- Equipos cuyos partidos entran en la liga.
CREATE TABLE edition_followed_teams (
    edition_id bigint NOT NULL,
    team_id bigint NOT NULL,
    CONSTRAINT edition_followed_teams_pkey PRIMARY KEY (edition_id, team_id),
    CONSTRAINT edition_followed_teams_edition_fkey FOREIGN KEY (edition_id) REFERENCES editions (id) ON DELETE CASCADE,
    CONSTRAINT edition_followed_teams_team_fkey FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);
CREATE INDEX idx_edition_followed_teams_team ON edition_followed_teams (team_id);

-- Partidos añadidos (included = true) o quitados (included = false) a mano.
CREATE TABLE edition_match_choices (
    edition_id bigint NOT NULL,
    match_id bigint NOT NULL,
    included boolean NOT NULL,
    CONSTRAINT edition_match_choices_pkey PRIMARY KEY (edition_id, match_id),
    CONSTRAINT edition_match_choices_edition_fkey FOREIGN KEY (edition_id) REFERENCES editions (id) ON DELETE CASCADE,
    CONSTRAINT edition_match_choices_match_fkey FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
);
CREATE INDEX idx_edition_match_choices_match ON edition_match_choices (match_id);
