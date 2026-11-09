-- Marcadores para juegos de mesa y similares: jugadores por nombre, sesiones (una por día de juego),
-- partidas con puntos y clasificación por sesión y acumulada. Se comparten con un código y se ven en directo.

CREATE TABLE score_trackers (
    id bigserial PRIMARY KEY,
    owner_user_id bigint NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    name varchar(120) NOT NULL,
    unit varchar(30) NOT NULL DEFAULT 'puntos',
    lower_wins boolean NOT NULL DEFAULT false,
    join_code varchar(12) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_trackers_owner ON score_trackers (owner_user_id);

CREATE TABLE score_tracker_members (
    tracker_id bigint NOT NULL REFERENCES score_trackers (id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tracker_id, user_id)
);
CREATE INDEX idx_score_tracker_members_user ON score_tracker_members (user_id);

CREATE TABLE score_tracker_players (
    id bigserial PRIMARY KEY,
    tracker_id bigint NOT NULL REFERENCES score_trackers (id) ON DELETE CASCADE,
    name varchar(40) NOT NULL,
    position integer NOT NULL
);
CREATE INDEX idx_score_tracker_players_tracker ON score_tracker_players (tracker_id);

CREATE TABLE score_tracker_sessions (
    id bigserial PRIMARY KEY,
    tracker_id bigint NOT NULL REFERENCES score_trackers (id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_tracker_sessions_tracker ON score_tracker_sessions (tracker_id);

CREATE TABLE score_tracker_rounds (
    id bigserial PRIMARY KEY,
    tracker_id bigint NOT NULL REFERENCES score_trackers (id) ON DELETE CASCADE,
    session_id bigint NOT NULL REFERENCES score_tracker_sessions (id) ON DELETE CASCADE,
    note varchar(120),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_tracker_rounds_tracker ON score_tracker_rounds (tracker_id);

CREATE TABLE score_tracker_scores (
    round_id bigint NOT NULL REFERENCES score_tracker_rounds (id) ON DELETE CASCADE,
    player_id bigint NOT NULL REFERENCES score_tracker_players (id) ON DELETE CASCADE,
    points integer NOT NULL,
    PRIMARY KEY (round_id, player_id)
);
