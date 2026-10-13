# ADR-0005: Lightweight CQRS in Reminder Service

## Status

Accepted

## Context

The original plan called for keeping CQRS minimal: separate commands from reads at service boundaries and in query models, without a separate data store. Reminder Service had a single `ReminderService` that both changed reminders and served list/detail reads through the same managed `Reminder` entities.

The service already splits writes and reads across services: Reminder Service publishes `reminder.triggered` events through its outbox and Notification Service builds its own `notification_logs` history from them. Within Reminder Service itself, there was no command/query split.

## Decision

Reminder Service separates its write and read paths while keeping one PostgreSQL schema:

- `ReminderCommandService` handles create, update and delete. It loads and changes the `Reminder` aggregate through `ReminderRepository`, the write-model repository also used by the trigger scheduler.
- `ReminderQueryService` handles list and detail reads in read-only transactions. It uses `ReminderQueryRepository`, which extends Spring Data's plain `Repository` marker (no save/delete methods) and projects rows directly into the `ReminderResponse` read model with JPQL constructor expressions.
- Commands still return the resulting `ReminderResponse`, so the public API contract does not change.

## Consequences

- Reads never load managed entities, so they skip dirty checking and cannot change reminder state by accident.
- Read queries can be tuned or moved to a dedicated read model (a replica, a denormalized table or a cache) without touching command code.
- Both sides read the same tables, so reads are immediately consistent with writes. There is no projection lag to handle.
- A separate read store or event-sourced projection is deliberately out of scope until read load justifies it.
