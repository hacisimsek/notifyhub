# Architecture Overview

NotifyHub is organized around a public Gateway Service, three domain services, a React dashboard and local infrastructure for persistence, messaging and monitoring.

```mermaid
flowchart LR
  user["User"] --> dashboard["React Dashboard"]
  dashboard --> gateway["Gateway Service"]
  api["API Client"] --> gateway

  gateway --> auth["Auth Service"]
  gateway --> reminder["Reminder Service"]
  gateway --> notification["Notification Service"]

  auth --> authdb[("PostgreSQL auth")]
  reminder --> reminderdb[("PostgreSQL reminder")]
  notification --> notificationdb[("PostgreSQL notification")]

  reminder --> kafka["Kafka reminder.triggered"]
  kafka --> notification

  notification --> rabbit["RabbitMQ delivery exchange"]
  rabbit --> delivery["Delivery worker"]
  delivery --> retry["Retry queue"]
  retry --> rabbit
  delivery --> dlq["DLQ"]

  prometheus["Prometheus"] --> gateway
  prometheus --> auth
  prometheus --> reminder
  prometheus --> notification
  grafana["Grafana"] --> prometheus
```

## Service Boundaries

- Gateway Service owns the external API surface, JWT verification and identity header propagation.
- Auth Service owns registration, login, password changes, password hashing, user roles and token issuing.
- Reminder Service owns reminder CRUD, owner checks, due reminder detection and Kafka event publishing.
- Notification Service owns notification logs, idempotency, delivery attempts, RabbitMQ dispatch, retry and DLQ handling.
- Dashboard owns the browser workflow for auth, profile settings, reminder management, notification history and delivery metrics. Runtime topology and event-stream panels are isolated to the Overview page instead of repeating across operational pages.

## Runtime Flow

```mermaid
sequenceDiagram
  participant User
  participant Dashboard
  participant Gateway
  participant Auth
  participant Reminder
  participant Kafka
  participant Notification
  participant RabbitMQ

  User->>Dashboard: Register or log in
  Dashboard->>Gateway: POST /api/auth/login
  Gateway->>Auth: Forward auth request
  Auth-->>Gateway: Bearer token
  Gateway-->>Dashboard: Auth response

  User->>Dashboard: Change password
  Dashboard->>Gateway: POST /api/auth/password
  Gateway->>Auth: Forward bearer token and password payload
  Auth-->>Gateway: Refreshed bearer token
  Gateway-->>Dashboard: Auth response

  User->>Dashboard: Create reminder
  Dashboard->>Gateway: POST /api/reminders
  Gateway->>Reminder: Forward with X-User-* headers
  Reminder-->>Gateway: Reminder response
  Gateway-->>Dashboard: Reminder response

  Reminder->>Reminder: Scheduler finds due reminder
  Reminder->>Kafka: Publish reminder.triggered
  Kafka->>Notification: Consume reminder event
  Notification->>RabbitMQ: Publish delivery work
  RabbitMQ->>Notification: Delivery worker consumes work
  Notification-->>Gateway: GET /api/notifications returns history
  Gateway-->>Dashboard: Delivery status
```

## Data Ownership

Each backend service owns its database schema. The local Docker Compose stack starts one PostgreSQL container with separate logical databases initialized for auth, reminder and notification data.

## Messaging Responsibilities

Kafka is used for durable domain events between Reminder Service and Notification Service. RabbitMQ is used for channel delivery work where retry, delay and DLQ behavior are operational concerns close to notification delivery.

## Observability

All backend services expose Spring Boot Actuator health and Prometheus metrics. Prometheus scrapes the services and Grafana provisions the `NotifyHub Overview` dashboard from repository files.
