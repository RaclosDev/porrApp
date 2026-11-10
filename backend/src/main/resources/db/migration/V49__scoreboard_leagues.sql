-- El marcador pasa a ser una liga más (kind = 'SCOREBOARD'), sin edición ni competición: sale en el
-- selector de ligas y en Mis ligas, y sus miembros son los de la liga. Dentro de una misma liga se
-- puede jugar a varios juegos (score_games); cada sesión es de un juego y el histórico los junta.

ALTER TABLE leagues ADD COLUMN kind varchar(20) NOT NULL DEFAULT 'POOL';

CREATE TABLE score_games (
    id bigserial PRIMARY KEY,
    league_id bigint NOT NULL REFERENCES leagues (id) ON DELETE CASCADE,
    name varchar(60) NOT NULL,
    unit varchar(30) NOT NULL DEFAULT 'puntos',
    lower_wins boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_games_league ON score_games (league_id);
CREATE UNIQUE INDEX uq_score_games_league_name ON score_games (league_id, lower(name));

-- Cada marcador existente se convierte en una liga con un único juego; el código se conserva, así
-- que los enlaces y los QR ya repartidos siguen funcionando.
INSERT INTO leagues (name, join_code, admin_user_id, created_at, kind)
SELECT left(name, 100), join_code, owner_user_id, created_at, 'SCOREBOARD'
FROM score_trackers;

CREATE TEMP TABLE tracker_league ON COMMIT DROP AS
SELECT t.id AS tracker_id, l.id AS league_id
FROM score_trackers t
JOIN leagues l ON l.join_code = t.join_code AND l.kind = 'SCOREBOARD';

INSERT INTO memberships (user_id, league_id, role, joined_at)
SELECT t.owner_user_id, m.league_id, 'ADMIN', t.created_at
FROM score_trackers t
JOIN tracker_league m ON m.tracker_id = t.id;

INSERT INTO memberships (user_id, league_id, role, joined_at)
SELECT sm.user_id, m.league_id, 'MEMBER', sm.joined_at
FROM score_tracker_members sm
JOIN tracker_league m ON m.tracker_id = sm.tracker_id
ON CONFLICT (user_id, league_id) DO NOTHING;

INSERT INTO score_games (league_id, name, unit, lower_wins, created_at)
SELECT m.league_id, left(t.name, 60), t.unit, t.lower_wins, t.created_at
FROM score_trackers t
JOIN tracker_league m ON m.tracker_id = t.id;

-- Jugadores, sesiones y partidas cuelgan de la liga; la sesión, además, de un juego.
ALTER TABLE score_tracker_players ADD COLUMN league_id bigint;
UPDATE score_tracker_players p SET league_id = m.league_id FROM tracker_league m WHERE m.tracker_id = p.tracker_id;
ALTER TABLE score_tracker_players ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE score_tracker_players
    ADD CONSTRAINT score_tracker_players_league_fk FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE;
ALTER TABLE score_tracker_players DROP COLUMN tracker_id;
CREATE INDEX idx_score_tracker_players_league ON score_tracker_players (league_id);
CREATE UNIQUE INDEX uq_score_tracker_players_league_user
    ON score_tracker_players (league_id, user_id) WHERE user_id IS NOT NULL;

ALTER TABLE score_tracker_sessions ADD COLUMN league_id bigint;
ALTER TABLE score_tracker_sessions ADD COLUMN game_id bigint;
UPDATE score_tracker_sessions s SET league_id = m.league_id FROM tracker_league m WHERE m.tracker_id = s.tracker_id;
UPDATE score_tracker_sessions s SET game_id = g.id FROM score_games g WHERE g.league_id = s.league_id;
ALTER TABLE score_tracker_sessions ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE score_tracker_sessions ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE score_tracker_sessions
    ADD CONSTRAINT score_tracker_sessions_league_fk FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE;
ALTER TABLE score_tracker_sessions
    ADD CONSTRAINT score_tracker_sessions_game_fk FOREIGN KEY (game_id) REFERENCES score_games (id) ON DELETE CASCADE;
ALTER TABLE score_tracker_sessions DROP COLUMN tracker_id;
CREATE INDEX idx_score_tracker_sessions_league ON score_tracker_sessions (league_id);
CREATE INDEX idx_score_tracker_sessions_game ON score_tracker_sessions (game_id);

ALTER TABLE score_tracker_rounds ADD COLUMN league_id bigint;
UPDATE score_tracker_rounds r SET league_id = m.league_id FROM tracker_league m WHERE m.tracker_id = r.tracker_id;
ALTER TABLE score_tracker_rounds ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE score_tracker_rounds
    ADD CONSTRAINT score_tracker_rounds_league_fk FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE;
ALTER TABLE score_tracker_rounds DROP COLUMN tracker_id;
CREATE INDEX idx_score_tracker_rounds_league ON score_tracker_rounds (league_id);

DROP TABLE score_tracker_members;
DROP TABLE score_trackers;
