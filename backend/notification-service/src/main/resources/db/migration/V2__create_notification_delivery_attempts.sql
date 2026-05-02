ALTER TABLE notification_logs
    ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE notification_logs
    ADD COLUMN last_attempt_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE notification_delivery_attempts (
    id UUID PRIMARY KEY,
    notification_log_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(500),
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_notification_delivery_attempts_log
        FOREIGN KEY (notification_log_id)
        REFERENCES notification_logs (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_notification_delivery_attempts_log_attempted_at
    ON notification_delivery_attempts (notification_log_id, attempted_at);
