CREATE INDEX idx_reminders_owner_created_at
    ON reminders (owner_id, created_at DESC);
