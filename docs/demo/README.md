# Demo Guide

This guide describes the repeatable local demo path for the current MVP.

## Prerequisites

- Java 21
- Node.js 20 or newer
- Docker Desktop
- `curl`
- `node`

## Automated Demo Check

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

With Minikube running, verify the Kubernetes path:

```bash
./scripts/k8s-local-verify.sh
```

This builds local images in Minikube, applies the manifests, waits for rollouts, port-forwards Gateway Service and runs the same gateway e2e smoke flow.

## Manual Dashboard Demo

1. Open `http://localhost:3000`.
2. Register a new user with an email and password.
3. Create an `EMAIL` reminder scheduled about one minute in the future.
4. Confirm the reminder appears in the reminder list.
5. Use reminder filters for status and channel.
6. Wait for the reminder to become `TRIGGERED`.
7. Open notification history and confirm the delivery status becomes `SENT`.
8. Use notification filters for status and channel.
9. Open `http://localhost:3001` and inspect the `NotifyHub Overview` dashboard.
10. Open `http://localhost:9090/targets` and confirm backend scrape targets are up.

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
- Kafka carries domain events; RabbitMQ handles delivery work, retry and DLQ behavior.
- Prometheus and Grafana provide service health, traffic and delivery failure visibility.
