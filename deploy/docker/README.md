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

Replace every `change-me` value in `deploy/docker/.env`. Passwords, `AUTH_JWT_SECRET` and `INTERNAL_SERVICE_TOKEN` have no defaults in
`compose.yml`; Compose stops with `Set <NAME> in deploy/docker/.env` when one is missing.
Keep `POSTGRES_PASSWORD` unchanged once the `postgres-data` volume exists, or recreate the volume with `down --volumes`.

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
- Gateway Service: `http://localhost:8080` (the only backend entry point)
- Auth, Reminder and Notification services listen on `8081`-`8083` inside the Compose network only.
  Reminder and Notification services reject requests without the shared `INTERNAL_SERVICE_TOKEN`.
- Dashboard: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

## Elastic Logging

The Elastic logging overlay adds Elasticsearch, Kibana and Logstash without changing the default local stack path.
Use it when you want Kibana-style log search for the Compose environment:

```bash
docker compose \
  --env-file deploy/docker/.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  up --build -d
```

Then verify indexing and create the local Kibana data view:

```bash
./scripts/elastic-local-verify.sh
```

Elastic endpoints:

- Elasticsearch: `http://localhost:9200`
- Kibana: `http://localhost:5601`
- Logstash API: `http://localhost:9600`
- Logstash GELF input: `udp://localhost:12201`

Kibana data view: `logs-notifyhub-*`.

For application-level audit events, open Kibana Discover and filter with `notifyhub.audit: true`.
Useful fields include `message`, `event.action`, `event.outcome`, `request.id`, `user.email`, `user.id`, `notifyhub.resource.type`, `notifyhub.resource.id`, `audit.notifyhub.channel`, and `audit.notifyhub.status`.

Stop the Elastic overlay with the same file set:

```bash
docker compose \
  --env-file deploy/docker/.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  down
```

## Stop

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down
```

To remove local database state:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down -v
```
