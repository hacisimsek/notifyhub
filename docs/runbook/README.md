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
The `Notification delivery` row shows delivery attempts by result (`SENT`, `RETRYING`, `FAILED`) for the last 15 minutes and per minute by channel.

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
Delivery work for a notification log that no longer exists is acknowledged and logged as `notification.delivery.discarded` instead of being requeued.

The mock sender fails every recipient containing `+fail` (for example `demo+fail@example.com`), which exercises retry and DLQ end to end.
Override the marker with `NOTIFICATION_MOCK_FAILURE_MARKER`; an empty value disables simulated failures.

## Kafka Event Flow

Reminder Service writes each `reminder.triggered` event to the `reminder_outbox_events` table in the same transaction that marks the reminder `TRIGGERED`.
The scheduler then publishes pending outbox rows to Kafka and stamps `published_at`. If Kafka is down, rows stay pending and are retried on the next run.
Both the due-reminder query and the outbox query use `FOR UPDATE SKIP LOCKED`, so several Reminder Service replicas never claim the same row.

Notification Service retries a failing Kafka record twice, then publishes it to `reminder.triggered.DLT`. Records that cannot be deserialized go straight to the DLT instead of blocking the partition.

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml exec kafka \
  kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic reminder.triggered.DLT --from-beginning
```

## Request Correlation

Every audit log line carries `request.id`. The id of the request that created a reminder is stored in `reminders.request_id`,
copied onto the `reminder.triggered` event and the RabbitMQ delivery work, and restored in the scheduler, Kafka and RabbitMQ
listeners. One id therefore links `reminder.create.requested` at the Gateway through `notification.delivery.sent` (or the
retry and `failed` lines). Reminders created before this column existed get a new id when they trigger.

```bash
REQ=<request-id>
for s in gateway-service reminder-service notification-service; do
  docker logs notifyhub-$s-1 2>&1 | grep notifyhub_audit | grep "\"request\":{\"id\":\"$REQ\"}"
done
```

In Kibana, filter on `request.id: "<request-id>"`.

## Security Controls

- Only the Gateway is published on a host port. Reminder and Notification services require `X-Internal-Token` (`INTERNAL_SERVICE_TOKEN`) on `/api/**` and `/internal/**`.
- `AUTH_JWT_SECRET` has no built-in default; Auth and Gateway fail at startup if it is missing or shorter than 32 bytes.
- Login is throttled per email: after 5 failures within 15 minutes Auth Service returns `429`. Counters live in Redis (`LOGIN_THROTTLE_REDIS_ENABLED=true`) and fall back to in-memory when Redis is disabled.
- Audit logs mask notification recipients (`j***@example.com`, `***2233`).
- The dashboard nginx config sends a strict Content-Security-Policy.

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

### Login returns 429

The email hit the failed-login limit. Wait for the window (`LOGIN_THROTTLE_WINDOW`, default 15 minutes) or clear the counter:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml exec redis \
  redis-cli del "notifyhub:auth:login-failures:user@example.com"
```

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
