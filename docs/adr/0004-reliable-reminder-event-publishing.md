# ADR-0004: Reliable Reminder Event Publishing

## Status

Accepted

## Context

Reminder Service marked a due reminder `TRIGGERED` and published `reminder.triggered` to Kafka inside the same database transaction. The two writes were not atomic:

- If the transaction rolled back after the Kafka send, consumers received an event for a reminder that was never triggered.
- If Kafka was unavailable, the scheduler failed and the whole batch was retried, mixing scheduling with broker health.
- With more than one Reminder Service replica, two schedulers could select the same due reminder and publish it twice.

On the consumer side, Notification Service used a plain `JsonDeserializer` with no error handler. A record that failed to deserialize, or an event the handler could not process, was retried forever and blocked the partition. This happened in practice: a reminder without a message produced an event the handler rejected.

## Decision

Use a transactional outbox in Reminder Service and a dead-letter topic in Notification Service.

- The scheduler writes the event to `reminder_outbox_events` in the same transaction that marks the reminder `TRIGGERED`. It no longer talks to Kafka.
- `ReminderOutboxPublisher` runs right after the scheduler, sends pending rows in creation order and stamps `published_at`. It stops at the first failed send, leaving that row and the rest pending for the next run.
- The due-reminder query and the outbox query both lock rows with `FOR UPDATE SKIP LOCKED`, so concurrent replicas split the work instead of duplicating it.
- Notification Service wraps its deserializer in `ErrorHandlingDeserializer`. Failed records are retried twice with a one-second back-off, then published to `reminder.triggered.DLT`.

## Consequences

- Delivery is at-least-once. A crash between the Kafka send and the `published_at` update re-sends the event; Notification Service deduplicates on the event's idempotency key (`reminder:<id>:<scheduledFor>`).
- A Kafka outage delays notifications by at most one scheduler interval after recovery, and no triggered reminder is lost.
- Poison messages are visible in `reminder.triggered.DLT` and no longer stall the consumer group. Records there need manual inspection; nothing replays them automatically.
- Published outbox rows are kept. A cleanup job is needed before the table grows large in a long-running environment.
- Event ordering is preserved per outbox batch, which matches the per-reminder Kafka key.

## Alternatives Considered

- **Publish after commit** (transaction synchronization): avoids phantom events but loses the event if the process stops between commit and send.
- **Change data capture** (Debezium on the outbox table): removes the polling publisher but adds Kafka Connect to the local and Kubernetes stacks, which is too heavy for this project's scope.
