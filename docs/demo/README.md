# Demo Guide

This guide describes the repeatable local demo path for the current MVP. The latest captured run, with screenshots and gate results, is in [evidence/](evidence/README.md).

## Prerequisites

- Java 21
- Node.js 20 or newer
- Docker Desktop
- `curl`
- `node`

## Automated Demo Check

Run the local non-destructive verification suite before environment-specific demos:

```bash
./scripts/final-verify.sh
```

Start the local stack:

```bash
cp deploy/docker/.env.example deploy/docker/.env
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

In another terminal, run:

```bash
./scripts/gateway-e2e-smoke.sh
```

Expected result:

```text
Gateway e2e smoke passed for smoke-...
```

The script proves the full path: register user, verify current user, create reminder, wait for scheduler, publish Kafka event, create notification log, dispatch delivery work and read final notification history through Gateway.

The same automated check can be run as a one-command background stack check:

```bash
./scripts/local-stack-e2e.sh
```

For a clean local data reset before the check:

```bash
RESET_STACK=true ./scripts/local-stack-e2e.sh
```

## Kubernetes Demo Check

Start Minikube with the Docker runtime, then verify the Kubernetes path:

```bash
minikube start --driver=docker --container-runtime=docker --cpus=4 --memory=6g
./scripts/k8s-local-verify.sh
```

This builds local images in Minikube, applies the manifests, waits for rollouts, port-forwards Gateway Service and runs the same gateway e2e smoke flow.

## Manual Dashboard Demo

1. Open `http://localhost:3000`. If another app already uses port `3000`, start the stack with `DASHBOARD_PORT=3002` and open that port instead.
2. Register a new user with an email and password.
3. Create an `EMAIL` reminder scheduled about one minute in the future.
4. Confirm the reminder appears in the reminder list.
5. Use reminder filters for status and channel.
6. Wait for the reminder to become `TRIGGERED`.
7. Open notification history and confirm the delivery status becomes `SENT`.
8. Use notification filters for status and channel.
9. Create a second reminder with recipient `demo+fail@example.com`. The mock sender fails it, so history shows `RETRYING` and then `FAILED` after 3 attempts, and the work item lands in `notifyhub.notifications.delivery.dlq` (RabbitMQ UI at `http://localhost:15672`, credentials `RABBITMQ_USERNAME`/`RABBITMQ_PASSWORD` from `deploy/docker/.env`).
10. Open `http://localhost:3001` and inspect the `NotifyHub Overview` dashboard.
11. Open `http://localhost:9090/targets` and confirm backend scrape targets are up.

## Reset Between Demo Runs

Stop the stack while preserving data:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down
```

Stop the stack and clear local state:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down --volumes
```

## Demo Talking Points

- Gateway is the only public backend entry point.
- JWT claims are verified at the gateway and propagated to internal services as identity headers.
- Reminder Service owns scheduling and emits domain events.
- Notification Service is idempotent on delivery work creation.
- Kafka carries domain events through a transactional outbox; unprocessable records go to `reminder.triggered.DLT`.
- RabbitMQ handles delivery work, retry and DLQ behavior; `+fail` recipients demonstrate it live.
- `FOR UPDATE SKIP LOCKED` lets several scheduler replicas run without double-triggering.
- Internal services trust identity headers only with the gateway's shared internal token.
- The dashboard never sees the access token: the Gateway keeps it in an HttpOnly `SameSite=Strict` cookie and requires `X-NotifyHub-Client` on cookie sessions.
- Gateway CORS allows only exact configured origins; the dashboard proxies `/api` itself and needs none.
- Reminder Service separates commands from queries: writes go through the `Reminder` aggregate, reads project straight into the response model ([ADR-0005](../adr/0005-reminder-cqrs.md)).
- Redis-backed login throttling, timing-safe unknown-email handling and masked recipients in audit logs.
- Prometheus and Grafana provide service health, traffic and delivery failure visibility.
