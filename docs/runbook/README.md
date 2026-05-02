# Runbook

This directory holds operational documentation for local development and demo environments.

## Local Monitoring

Start the Docker Compose stack from the repository root:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

Prometheus runs at `http://localhost:9090` and scrapes backend services through `/actuator/prometheus`.
Grafana runs at `http://localhost:3001` with the local development credentials from `deploy/docker/.env`.

Open the `NotifyHub Overview` dashboard to inspect service availability, request rate, average latency, JVM heap usage and HTTP 5xx rate.

## Planned Topics

- Starting and stopping the local environment
- Common failure modes
- Final demo flow

## RabbitMQ Delivery Queues

Notification delivery uses RabbitMQ in the local Docker stack. The key queues are:

- `notifyhub.notifications.delivery`
- `notifyhub.notifications.delivery.retry`
- `notifyhub.notifications.delivery.dlq`

The retry queue uses a TTL and dead-letters work back to the delivery exchange. When the configured attempt limit is reached, Notification Service marks the notification log as `FAILED` and publishes the work item to the DLQ.
Every send attempt is recorded in `notification_delivery_attempts`; the parent notification log keeps `attempt_count` and `last_attempt_at` for quick history views.

## Alert Response

Prometheus loads alert rules from `observability/prometheus/rules`.

- `NotifyHubServiceDown`: check the target service container or pod, then inspect `/actuator/health`.
- `NotifyHubHighServerErrorRate`: inspect gateway and service logs for repeated 5xx responses.
- `NotifyHubNotificationDeliveryFailures`: inspect `notification_delivery_attempts` for failed attempts and check RabbitMQ DLQ messages.
- `NotifyHubNotificationDeliveryRetries`: inspect provider/mock sender failures and RabbitMQ retry queue health.
