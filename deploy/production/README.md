# NotifyHub Public VPS Deployment

This runbook publishes NotifyHub on a single low-cost VPS with Docker Compose, Caddy HTTPS, Prometheus/Grafana and Elastic/Kibana. It is production-minded for low traffic, but it is not high availability.

## Target

- `https://app.<domain>` serves the dashboard and proxies `/api` to the Gateway through the dashboard nginx container.
- `https://grafana.<domain>` serves Grafana with Grafana login required.
- `https://kibana.<domain>` serves Kibana behind Caddy Basic Auth.
- PostgreSQL, Redis, Kafka, RabbitMQ, backend services, Elasticsearch, Prometheus and Logstash API are not exposed publicly.
- Logstash GELF is bound to `127.0.0.1` only because the Docker logging driver sends GELF logs through the VPS host loopback.

## VPS Setup

Use an Ubuntu LTS VPS with at least 4 vCPU and 8 GB RAM while Elastic/Kibana is part of the live stack. A Hetzner CX32-class server is the expected starting point for cost and learning value.

Create DNS `A` records pointing to the VPS public IP:

```text
app.<domain>      A  <vps-ip>
grafana.<domain>  A  <vps-ip>
kibana.<domain>   A  <vps-ip>
```

Harden the server before deploying:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Disable root/password SSH login in `/etc/ssh/sshd_config`:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Reload SSH and enable only the public ports:

```bash
sudo systemctl reload ssh
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Install Docker Engine and the Compose plugin using Docker's official Ubuntu instructions. The production override uses Compose `!reset` and `!override`, so use Docker Compose plugin `2.24.4` or newer.

Check the installed version:

```bash
docker compose version
```

Then add the deploy user to the Docker group:

```bash
sudo usermod -aG docker deploy
```

Log out and back in before running Docker as `deploy`.

## Environment

Create the production env file on the VPS. Do not commit it.

```bash
cp deploy/production/production.env.example deploy/production/production.env
chmod 600 deploy/production/production.env
```

Generate strong secrets:

```bash
openssl rand -base64 48
```

Generate the Kibana Basic Auth hash:

```bash
docker run --rm -it caddy:2.8-alpine caddy hash-password --plaintext 'replace-with-kibana-password'
```

Put the resulting hash in `KIBANA_BASIC_AUTH_HASH`. If the hash contains `$`, wrap the value in single quotes in `production.env`.

## Deploy

Clone the repository on the VPS and deploy from the repository root:

```bash
docker compose \
  --env-file deploy/production/production.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  -f deploy/production/compose.production.yml \
  up --build -d
```

Inspect the stack:

```bash
docker compose \
  --env-file deploy/production/production.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  -f deploy/production/compose.production.yml \
  ps
```

Follow logs:

```bash
docker compose \
  --env-file deploy/production/production.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  -f deploy/production/compose.production.yml \
  logs -f --tail=200
```

Update deployment after merging changes:

```bash
git pull --ff-only origin main
docker compose \
  --env-file deploy/production/production.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  -f deploy/production/compose.production.yml \
  up --build -d
docker image prune -f
```

## Verification

Run local release gates before deploying:

```bash
./scripts/final-verify.sh
TEARDOWN=true ./scripts/local-stack-e2e.sh
```

Verify the VPS after deploy:

```bash
curl -f https://app.<domain>/healthz
docker compose \
  --env-file deploy/production/production.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  -f deploy/production/compose.production.yml \
  ps
```

Manual smoke flow:

- Open `https://app.<domain>`.
- Register and log in.
- Create a reminder and verify it appears newest first.
- Check notification history after the reminder triggers.
- Open Grafana and verify dashboards and Prometheus targets.
- Open Kibana and query `notifyhub.audit: true`.

Security acceptance:

- External scans should show only `22`, `80` and `443`.
- Direct external access to `8080`, `8081`, `8082`, `8083`, `5432`, `6379`, `5672`, `9092`, `9200`, `9600`, `12201` and `9090` must fail.
- `deploy/production/production.env` must not contain the development defaults from local compose.

## Backups

The `postgres-backup` service writes a compressed `pg_dumpall` file every 24 hours into the `postgres-backups` Docker volume and deletes files older than `POSTGRES_BACKUP_RETENTION_DAYS`.

List backups:

```bash
docker compose \
  --env-file deploy/production/production.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  -f deploy/production/compose.production.yml \
  exec postgres-backup ls -lh /backups
```

For a real production launch, copy backups off the VPS to S3-compatible object storage or another remote location. Before restoring, take a fresh backup and stop the app services that write to PostgreSQL.

## Current Limits

- Single VPS means no high availability.
- PostgreSQL and Elastic data live on the VPS disk.
- Elasticsearch security is disabled inside the Docker network; Kibana is protected publicly by Caddy Basic Auth.
- The first deployment builds images on the VPS. A later phase can add GitHub Actions SSH deploy and a container registry.
