# NotifyHub

NotifyHub is a smart reminder and notification platform for time-sensitive alerts. The project is planned as a microservice-based system with Spring Boot services, React dashboard, PostgreSQL, Redis, Kafka, RabbitMQ, Docker, Kubernetes, Prometheus and Grafana.

## Goals

- Let users create and manage reminders.
- Trigger reminder events at the right time.
- Deliver notifications through email, SMS/mock and push/mock channels.
- Track delivery attempts and final status.
- Provide a dashboard for reminder management and delivery analytics.
- Demonstrate production-minded concerns: security, messaging reliability, CI, containerization, observability and runbooks.

## Current Status

The repository is in final delivery polish. It contains a working MVP vertical slice:

1. Register and log in through the dashboard or Gateway API.
2. Create, update, delete and filter one-time reminders.
3. Trigger due reminders from Reminder Service.
4. Publish reminder events through Kafka.
5. Create notification logs and dispatch delivery work through RabbitMQ.
6. Retry failed delivery work and route exhausted work to a DLQ.
7. Show reminders, notification history, filters and delivery metrics in the dashboard.
8. Run the local stack with Docker Compose and validate it with a gateway e2e smoke script.

Final handoff work is now focused on running the full local demo in the target environment and capturing evidence.

## Planned Structure

```text
notifyhub/
  backend/
    common/
    auth-service/
    reminder-service/
    notification-service/
    gateway-service/
  web/
    dashboard/
  deploy/
    docker/
    k8s/
  observability/
    prometheus/
    grafana/
  docs/
    adr/
    api/
    runbook/
  scripts/
```

## Tech Stack

- Backend: Java 21, Spring Boot 3.x, Maven
- Frontend: React, Vite, Tailwind CSS
- Database: PostgreSQL
- Cache: Redis
- Messaging: Apache Kafka and RabbitMQ
- Security: JWT, RBAC, Spring Security
- Runtime: Docker, Kubernetes with Minikube
- Observability: Spring Boot Actuator, Micrometer, Prometheus, Grafana
- CI/CD: GitHub Actions

## Local Development

Use the commands below to build, run and validate the current local MVP. The expected local prerequisites are:

- Java 21
- Maven 3.9+
- Node.js 20+
- Docker Desktop
- Minikube

### Backend

```bash
mvn -B -ntp -f backend/pom.xml verify
```

### CI Checks

Pull requests run targeted checks for backend, dashboard and local stack changes:

- Backend: Maven verify for all backend modules.
- Dashboard: dependency install and production build.
- Docker images: backend service and dashboard image builds.
- Local stack: Docker Compose config rendering.
- Kubernetes: YAML parsing and Kustomize rendering for local manifests.

Run the main local verification suite:

```bash
./scripts/final-verify.sh
```

To include environment-dependent e2e checks:

```bash
RUN_FULL_STACK=true RUN_K8S=true ./scripts/final-verify.sh
```

### Docker Compose

Local backend stack can be started with PostgreSQL, Kafka, RabbitMQ, Redis and all backend services:

```bash
cp deploy/docker/.env.example deploy/docker/.env
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

The Gateway Service is available at `http://localhost:8080`.
The Dashboard is available at `http://localhost:3000`.
Prometheus is available at `http://localhost:9090`.
Grafana is available at `http://localhost:3001`.

After the stack is healthy, run the gateway smoke test:

```bash
./scripts/gateway-e2e-smoke.sh
```

In the Docker stack, Notification Service consumes reminder events from Kafka and dispatches notification work through RabbitMQ delivery, retry and DLQ queues.

To build the stack, start it in the background and run the e2e smoke check in one command:

```bash
./scripts/local-stack-e2e.sh
```

To stop the stack:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down
```

### Kubernetes

Local Minikube manifests live under `deploy/k8s`:

```bash
kubectl apply -k deploy/k8s/base
```

To build local images inside Minikube, apply the manifests, wait for rollouts and run the gateway smoke flow:

```bash
./scripts/k8s-local-verify.sh
```

### Dashboard

The dashboard app lives under `web/dashboard` and talks to the Gateway Service through `/api`:

```bash
npm install --prefix web/dashboard
npm run test --prefix web/dashboard
npm run dev --prefix web/dashboard
```

Auth Service runs on port `8081` and exposes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/password`
- `GET /api/i18n/messages`

Reminder Service runs on port `8082` and exposes:

- `POST /api/reminders`
- `GET /api/reminders`
- `GET /api/reminders/{id}`
- `PUT /api/reminders/{id}`
- `DELETE /api/reminders/{id}`

Notification Service runs on port `8083` and exposes:

- `POST /internal/notifications`
- `GET /api/notifications`

Gateway Service runs on port `8080` and exposes the external API surface:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/password`
- `GET /api/i18n/messages`
- `POST /api/reminders`
- `GET /api/reminders`
- `GET /api/reminders/{id}`
- `PUT /api/reminders/{id}`
- `DELETE /api/reminders/{id}`
- `GET /api/notifications`

## Documentation

- Execution plan: [EXECUTION_PLAN.md](./EXECUTION_PLAN.md)
- Architecture overview: [docs/architecture](./docs/architecture)
- Architecture decisions: [docs/adr](./docs/adr)
- API notes: [docs/api](./docs/api)
- OpenAPI reference: [docs/api/openapi.yaml](./docs/api/openapi.yaml)
- Demo guide: [docs/demo](./docs/demo)
- Runbook: [docs/runbook](./docs/runbook)
