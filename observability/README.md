# Observability

Local observability is built around Spring Boot Actuator, Micrometer, Prometheus and Grafana.

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

## Scraped Services

Prometheus scrapes the backend services through `/actuator/prometheus`:

- Gateway Service
- Auth Service
- Reminder Service
- Notification Service
