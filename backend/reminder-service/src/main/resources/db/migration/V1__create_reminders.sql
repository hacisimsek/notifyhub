CREATE TABLE reminders (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    title VARCHAR(140) NOT NULL,
    message VARCHAR(1000),
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    channel VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_reminders_owner_scheduled_for
    ON reminders (owner_id, scheduled_for);
