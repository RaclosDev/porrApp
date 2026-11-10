-- La liga de juegos de mesa se apunta como una hoja de papel: cada quedada es un día de juego con sus
-- asistentes; cada partida es de un juego, tiene sus participantes y se termina. Un juego se puntúa por
-- puntos (gana quien más o quien menos) o por victorias. Cada ronda guarda quién la apuntó.

ALTER TABLE score_games ADD COLUMN mode varchar(10) NOT NULL DEFAULT 'POINTS';

CREATE TABLE score_days (
    id bigserial PRIMARY KEY,
    league_id bigint NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    legacy_session_id bigint
);
CREATE INDEX idx_score_days_league ON score_days (league_id);

CREATE TABLE score_day_players (
    day_id bigint NOT NULL REFERENCES score_days (id) ON DELETE CASCADE,
    player_id bigint NOT NULL REFERENCES score_tracker_players (id) ON DELETE CASCADE,
    PRIMARY KEY (day_id, player_id)
);
CREATE INDEX idx_score_day_players_player ON score_day_players (player_id);

CREATE TABLE score_session_players (
    session_id bigint NOT NULL REFERENCES score_tracker_sessions (id) ON DELETE CASCADE,
    player_id bigint NOT NULL REFERENCES score_tracker_players (id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, player_id)
);
CREATE INDEX idx_score_session_players_player ON score_session_players (player_id);

ALTER TABLE score_tracker_sessions ADD COLUMN day_id bigint;
ALTER TABLE score_tracker_sessions ADD COLUMN ended_at timestamptz;
ALTER TABLE score_tracker_sessions ADD COLUMN planned_rounds integer;

ALTER TABLE score_tracker_rounds
    ADD COLUMN created_by_user_id bigint REFERENCES app_users (id) ON DELETE SET NULL;

-- Cada partida antigua pasa a ser un día con todos los jugadores de la liga como asistentes y
-- participantes. Solo la última partida de cada liga (y su día) siguen abiertos; las demás terminaron
-- cuando se empezó la siguiente.
INSERT INTO score_days (league_id, started_at, legacy_session_id)
SELECT league_id, started_at, id FROM score_tracker_sessions;

UPDATE score_tracker_sessions s SET day_id = d.id FROM score_days d WHERE d.legacy_session_id = s.id;

INSERT INTO score_day_players (day_id, player_id)
SELECT d.id, p.id FROM score_days d JOIN score_tracker_players p ON p.league_id = d.league_id;

INSERT INTO score_session_players (session_id, player_id)
SELECT s.id, p.id FROM score_tracker_sessions s JOIN score_tracker_players p ON p.league_id = s.league_id;

UPDATE score_tracker_sessions s
SET ended_at = coalesce((SELECT max(r.created_at) FROM score_tracker_rounds r WHERE r.session_id = s.id), s.started_at)
WHERE s.id <> (SELECT max(last.id) FROM score_tracker_sessions last WHERE last.league_id = s.league_id);

UPDATE score_days d SET closed_at = s.ended_at
FROM score_tracker_sessions s WHERE s.day_id = d.id AND s.ended_at IS NOT NULL;

ALTER TABLE score_days DROP COLUMN legacy_session_id;
ALTER TABLE score_tracker_sessions ALTER COLUMN day_id SET NOT NULL;
ALTER TABLE score_tracker_sessions
    ADD CONSTRAINT score_tracker_sessions_day_fk FOREIGN KEY (day_id) REFERENCES score_days (id) ON DELETE CASCADE;
CREATE INDEX idx_score_tracker_sessions_day ON score_tracker_sessions (day_id);
