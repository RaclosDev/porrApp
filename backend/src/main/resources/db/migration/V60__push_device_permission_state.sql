CREATE TABLE push_device_states (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    permission VARCHAR(16) NOT NULL CHECK (permission IN ('default', 'granted', 'denied', 'unsupported')),
    install_required BOOLEAN NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    last_prompt_at TIMESTAMPTZ,
    UNIQUE (user_id, device_id)
);
