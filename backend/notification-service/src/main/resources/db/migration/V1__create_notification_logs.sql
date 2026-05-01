CREATE TABLE notification_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    reminder_id UUID,
    channel VARCHAR(32) NOT NULL,
    recipient VARCHAR(320) NOT NULL,
    subject VARCHAR(140) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(500),
    idempotency_key VARCHAR(180) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notification_logs_user_created_at
    ON notification_logs (user_id, created_at DESC);
