# Elastic Logging

This directory contains the local Elastic logging overlay for NotifyHub.

## Start

```bash
docker compose \
  --env-file deploy/docker/.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  up --build -d
```

Run the verification script after the stack is healthy:

```bash
./scripts/elastic-local-verify.sh
```

## Endpoints

- Elasticsearch: `http://localhost:9200`
- Kibana: `http://localhost:5601`
- Logstash API: `http://localhost:9600`
- Logstash GELF input: `udp://localhost:12201`

Kibana data view: `logs-notifyhub-*`.

## How Logs Flow

The Elastic overlay changes the Docker logging driver for NotifyHub services to GELF.
Docker sends container logs to Logstash on UDP port `12201`.
Logstash normalizes basic container fields and writes to the `logs-notifyhub-local` Elasticsearch data stream.
Kibana reads those logs through the `logs-notifyhub-*` data view.

## Audit Trail

NotifyHub emits structured audit events for user-facing actions such as registration, login, profile updates, reminder create/list/view/update/delete, reminder triggering, notification creation, delivery, and notification history reads.

In Kibana Discover, use the `logs-notifyhub-*` data view and filter on:

- `notifyhub.audit: true` to show only application audit events.
- `user.email: "user@example.com"` to follow one user.
- `event.action: "reminder.created"` or `event.action: "notification.delivery.sent"` to isolate an action.
- `notifyhub.resource.type: "reminder"` and `notifyhub.resource.id: "<id>"` to follow one reminder.
- `event.outcome: "failure"` to find failed login or delivery attempts.

Useful columns:

- `@timestamp`
- `message`
- `event.action`
- `event.outcome`
- `user.email`
- `user.id`
- `notifyhub.resource.type`
- `notifyhub.resource.id`
- `audit.notifyhub.channel`
- `audit.notifyhub.status`

## Production Notes

The local overlay is production-like for data flow and operator workflow, but it is not a production deployment.
Before using this pattern in a real environment:

- Enable Elasticsearch and Kibana authentication.
- Configure TLS between clients, Kibana, Logstash and Elasticsearch.
- Use ILM retention based on daily log volume and incident investigation needs.
- Enable snapshots and test restore.
- Run the logging cluster outside the application failure domain.
- Define index/data stream mappings for structured application fields.
- Standardize JSON application logs and include request/correlation IDs.
