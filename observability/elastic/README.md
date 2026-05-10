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
