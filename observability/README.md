# Observability

Local observability is built around Spring Boot Actuator, Micrometer, Prometheus and Grafana.
Elastic logging is available as an opt-in Docker Compose overlay for Kibana-style log search.

## Local Stack

Start the full local stack from the repository root:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

Prometheus is available at `http://localhost:9090`.
Grafana is available at `http://localhost:3001`.

Default Grafana credentials for local development:

- Username: `admin`
- Password: `notifyhub`

The provisioned dashboard is under the `NotifyHub` folder and uses the local Prometheus data source.

Prometheus also loads local alert rules from `observability/prometheus/rules`.

## Scraped Services

Prometheus scrapes the backend services through `/actuator/prometheus`:

- Gateway Service
- Auth Service
- Reminder Service
- Notification Service

## Alerts

The local rule set covers:

- backend service scrape failures
- elevated 5xx response rates
- notification delivery failures
- elevated notification retry volume

Notification delivery alerts use the `notifyhub_notification_delivery_attempts_total` counter emitted by Notification Service with `channel` and `status` labels.

## Elastic Logging

Use the Elastic overlay when local testing needs production-like log exploration:

```bash
docker compose \
  --env-file deploy/docker/.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  up --build -d

./scripts/elastic-local-verify.sh
```

The overlay adds:

- Elasticsearch for log storage and search.
- Kibana for Discover and dashboard workflows.
- Logstash as the local ingest bridge from Docker GELF logs into the `logs-notifyhub-local` data stream.

Kibana is available at `http://localhost:5601`.
The local data view is `logs-notifyhub-*`.

Application audit logs are parsed into searchable Kibana fields. Use `notifyhub.audit: true` to focus on user actions, then filter by `request.id`, `user.email`, `event.action`, `event.outcome`, or `notifyhub.resource.id`.

The local overlay intentionally disables Elasticsearch security to keep developer setup repeatable. A production deployment must enable authentication and TLS, set retention through ILM, configure snapshots, size storage from daily log volume, and run Elasticsearch/Kibana outside the application failure domain.
