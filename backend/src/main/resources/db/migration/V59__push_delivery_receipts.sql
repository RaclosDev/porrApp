ALTER TABLE push_subscriptions ADD COLUMN receipts_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE push_delivery_retries
    ADD COLUMN receipt_token UUID UNIQUE,
    ADD COLUMN receipt_expected BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN accepted_at TIMESTAMPTZ,
    ADD COLUMN received_at TIMESTAMPTZ,
    ADD COLUMN finished_at TIMESTAMPTZ;
CREATE INDEX idx_push_receipt_cleanup ON push_delivery_retries(expires_at);
DROP INDEX idx_push_retry_due;
CREATE INDEX idx_push_retry_due ON push_delivery_retries(next_attempt_at) WHERE finished_at IS NULL;
