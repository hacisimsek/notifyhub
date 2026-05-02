# Local Docker Environment

This compose stack runs the local infrastructure, backend services and dashboard for NotifyHub.

Requirements:

- Docker Desktop running.
- `curl` and Node.js available for the smoke test script.

## Start

```bash
cp deploy/docker/.env.example deploy/docker/.env
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

The gateway is exposed at `http://localhost:8080`.
The dashboard is exposed at `http://localhost:3000`.
Prometheus is exposed at `http://localhost:9090`.
Grafana is exposed at `http://localhost:3001`.

Run the gateway smoke test after the stack is healthy:

```bash
./scripts/gateway-e2e-smoke.sh
```

The smoke test registers a temporary user, creates a reminder through the gateway, waits for the Kafka-backed reminder flow, and checks notification history for a `SENT` delivery.

For the repeatable one-command path from the repository root:

```bash
./scripts/local-stack-e2e.sh
```

Useful options:

- `RESET_STACK=true ./scripts/local-stack-e2e.sh` stops the compose project and removes local volumes before starting.
- `TEARDOWN=true ./scripts/local-stack-e2e.sh` stops the compose project after the smoke check.
- `SMOKE_TIMEOUT_SECONDS=240 ./scripts/local-stack-e2e.sh` gives slower machines more time for the reminder flow.

## Services

- PostgreSQL: `localhost:5432`
- Kafka external listener: `localhost:9092`
- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ management UI: `http://localhost:15672`
- Redis: `localhost:6379`
- Auth Service: `http://localhost:8081`
- Reminder Service: `http://localhost:8082`
- Notification Service: `http://localhost:8083`
- Gateway Service: `http://localhost:8080`
- Dashboard: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

## Stop

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down
```

To remove local database state:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down -v
```
