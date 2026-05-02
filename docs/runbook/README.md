# Runbook

This directory holds operational documentation for local development and demo environments.

## Start Local Environment

From the repository root:

```bash
cp deploy/docker/.env.example deploy/docker/.env
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

Main local URLs:

- Gateway: `http://localhost:8080`
- Dashboard: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- RabbitMQ management: `http://localhost:15672`

RabbitMQ and Grafana use the local credentials from `deploy/docker/.env`.

## Health Checks

Use Gateway health as the first readiness signal:

```bash
curl --fail --silent --show-error http://localhost:8080/actuator/health
```

For a full vertical-slice check:

```bash
./scripts/gateway-e2e-smoke.sh
```

The smoke script registers a temporary user, creates a reminder due shortly, waits for the notification history entry and expects final status `SENT`.

## Final Verification

Before a handoff or demo, run:

```bash
./scripts/final-verify.sh
```

This runs backend verification, dashboard tests/build, OpenAPI YAML parsing, Kubernetes manifest rendering, Docker Compose config rendering and shell script syntax checks.

When Docker Desktop and Minikube are available, include the environment-dependent e2e checks:

```bash
RUN_FULL_STACK=true RUN_K8S=true ./scripts/final-verify.sh
```

## Local Monitoring

Start the Docker Compose stack from the repository root:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

Prometheus runs at `http://localhost:9090` and scrapes backend services through `/actuator/prometheus`.
Grafana runs at `http://localhost:3001` with the local development credentials from `deploy/docker/.env`.

Open the `NotifyHub Overview` dashboard to inspect service availability, request rate, average latency, JVM heap usage and HTTP 5xx rate.

## Stop Local Environment

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down
```

Add `--volumes` when a clean database and broker state are needed:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down --volumes
```

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

## Common Failures

### Gateway is healthy but dashboard requests fail

Check that the dashboard container can reach Gateway through nginx `/api` proxying and that Gateway has the correct service URLs:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml logs gateway-service dashboard
```

### Reminder was created but no notification appears

Check Reminder Service scheduler, Kafka and Notification Service consumer logs:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml logs reminder-service kafka notification-service
```

Confirm the reminder is due and still in `SCHEDULED` state. The local scheduler runs every few seconds by default.

### Notification stays in retrying or failed state

Inspect RabbitMQ management at `http://localhost:15672`, then check the delivery attempt rows in the notification database. Exhausted work is copied to `notifyhub.notifications.delivery.dlq`.

### Ports are already in use

Override ports in `deploy/docker/.env`, then restart the stack. The dashboard and API docs should reference the overridden Gateway and dashboard ports during manual testing.

## Final Demo Flow

1. Start the Docker Compose stack.
2. Wait for Gateway health.
3. Open the dashboard at `http://localhost:3000`.
4. Register a new user.
5. Create an email reminder scheduled about one minute in the future.
6. Refresh the dashboard until the reminder moves from `SCHEDULED` to `TRIGGERED`.
7. Open notification history and confirm a `SENT` delivery entry.
8. Show Prometheus targets and the Grafana overview dashboard.
9. Run `./scripts/gateway-e2e-smoke.sh` as the repeatable command-line proof.
