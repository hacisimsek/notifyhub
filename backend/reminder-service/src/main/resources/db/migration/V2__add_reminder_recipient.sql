ALTER TABLE reminders
    ADD COLUMN recipient VARCHAR(320) NOT NULL DEFAULT 'user@example.com';

ALTER TABLE reminders
    ALTER COLUMN recipient DROP DEFAULT;
