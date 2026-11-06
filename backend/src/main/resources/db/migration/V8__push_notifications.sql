-- Suscripciones Web Push y recordatorios de partido ya enviados.

CREATE TABLE push_subscriptions (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    endpoint text NOT NULL,
    p256dh varchar(255) NOT NULL,
    auth varchar(255) NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
    CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

CREATE TABLE match_reminders_sent (
    user_id bigint NOT NULL,
    match_id bigint NOT NULL,
    sent_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT match_reminders_sent_pkey PRIMARY KEY (user_id, match_id),
    CONSTRAINT match_reminders_sent_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
    CONSTRAINT match_reminders_sent_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);
