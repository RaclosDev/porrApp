-- Quien entra a un marcador con su cuenta puede decir cuál de los jugadores es él. Si se borra la
-- cuenta, el jugador se queda como un nombre suelto.

ALTER TABLE score_tracker_players
    ADD COLUMN user_id bigint REFERENCES app_users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_score_tracker_players_user
    ON score_tracker_players (tracker_id, user_id) WHERE user_id IS NOT NULL;
