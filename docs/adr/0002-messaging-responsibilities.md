# ADR-0002: Kafka and RabbitMQ Responsibilities

## Status

Accepted

## Context

The project intentionally includes both Kafka and RabbitMQ. Without clear responsibilities, the system can become redundant or confusing.

## Decision

Kafka is the system event stream. It will carry durable domain events such as `reminder.triggered`.

RabbitMQ is the delivery work queue. It will distribute channel-specific notification work, support retries and route failed work to dead letter queues.

## Consequences

- Reminder Service publishes canonical events to Kafka.
- Notification Service consumes Kafka events and creates delivery work.
- Channel workers consume RabbitMQ queues.
- Retry, DLQ and queue depth concerns stay close to delivery processing.
- Kafka is not used as a task queue, and RabbitMQ is not used as the canonical event log.
