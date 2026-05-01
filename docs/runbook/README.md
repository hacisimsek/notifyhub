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
- Kafka and RabbitMQ inspection
- Dead letter queue handling
- Final demo flow
