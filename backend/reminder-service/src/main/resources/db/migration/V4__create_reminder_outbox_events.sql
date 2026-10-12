CREATE TABLE reminder_outbox_events (
    id UUID PRIMARY KEY,
    reminder_id UUID NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_reminder_outbox_events_pending
    ON reminder_outbox_events (published_at, created_at);
