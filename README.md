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

The repository is in the foundation phase. The first milestone is a working vertical slice:

1. Register and log in.
2. Create a one-time reminder.
3. Trigger the reminder.
4. Create a notification log.
5. Show the reminder and delivery status in the dashboard.

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

Detailed commands will be added as services are scaffolded. The expected local prerequisites are:

- Java 21
- Maven 3.9+
- Node.js 20+
- Docker Desktop
- Minikube

### Backend

```bash
mvn -B -ntp -f backend/pom.xml verify
```

Auth Service runs on port `8081` and exposes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Reminder Service runs on port `8082` and exposes:

- `POST /api/reminders`
- `GET /api/reminders`
- `GET /api/reminders/{id}`
- `PUT /api/reminders/{id}`
- `DELETE /api/reminders/{id}`

## Documentation

- Execution plan: [EXECUTION_PLAN.md](./EXECUTION_PLAN.md)
- Architecture decisions: [docs/adr](./docs/adr)
- API notes: [docs/api](./docs/api)
- Runbook: [docs/runbook](./docs/runbook)
