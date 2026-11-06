-- Avisos push entregados a cada usuario, para mostrarle los últimos en el centro de avisos.
-- Se guardan 30 días como mucho (PushNotificationLogService) y se borran con la cuenta.

CREATE TABLE push_notification_log (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    title varchar(255) NOT NULL,
    body varchar(500) NOT NULL,
    url varchar(255),
    sent_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT push_notification_log_pkey PRIMARY KEY (id),
    CONSTRAINT push_notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);

CREATE INDEX idx_push_notification_log_user_sent ON push_notification_log (user_id, sent_at DESC);
