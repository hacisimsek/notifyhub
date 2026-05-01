# Local Docker Environment

This compose stack runs the local infrastructure and backend services for NotifyHub.

## Start

```bash
cp deploy/docker/.env.example deploy/docker/.env
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

The gateway is exposed at `http://localhost:8080`.

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

## Stop

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down
```

To remove local database state:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml down -v
```
