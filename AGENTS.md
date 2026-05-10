# AGENTS.md

Project working notes for future agent runs in this repository.

## Repository

- Default base branch is `main`.
- Before starting new work after a merge, update local `main` with:

```bash
git fetch origin
git switch main
git merge --ff-only origin/main
```

- Use professional branch names only. Do not use `codex` in branch names.
- Preferred branch prefixes: `feature/`, `fix/`, `docs/`, `ci/`, `release/`.
- Open ready pull requests by default, not draft PRs, unless explicitly requested.
- Stage only files that belong to the current change.

## Local Targets

- Gateway API: `http://localhost:8080`
- Dashboard UI: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- Elasticsearch: `http://localhost:9200`
- Kibana: `http://localhost:5601`

Note: `http://localhost:8080` is the Gateway API, not the dashboard application.

## Public VPS Deployment

- Remote low-cost deployment assets live in `deploy/production/`.
- Production compose command layers `deploy/docker/compose.yml`, `deploy/docker/compose.elastic.yml` and `deploy/production/compose.production.yml`.
- Only Caddy should publish public ports on the VPS: `80` and `443`. SSH `22` is opened by UFW, not Docker.
- Keep `deploy/production/production.env` untracked and use `deploy/production/production.env.example` as the template.

## Release Gates

Run the relevant checks for the touched area. For release/demo readiness, use:

```bash
./scripts/final-verify.sh
TEARDOWN=true ./scripts/local-stack-e2e.sh
./scripts/k8s-local-verify.sh
```

Use Docker Desktop for the Compose gate and Minikube for the Kubernetes gate.

## Observability

- Local metrics use Prometheus and Grafana.
- Optional local log search uses the Elastic overlay:

```bash
docker compose \
  --env-file deploy/docker/.env \
  -f deploy/docker/compose.yml \
  -f deploy/docker/compose.elastic.yml \
  up --build -d
```

- Verify Elastic/Kibana setup with:

```bash
./scripts/elastic-local-verify.sh
```

- In Kibana Discover, use data view `logs-notifyhub-*`.
- Useful audit filters:
  - `notifyhub.audit: true`
  - `request.id: "<request-id>"`
  - `user.email: "user@example.com"`
  - `event.action: "reminder.created"`
  - `event.outcome: "failure"`

## Documentation Policy

- Keep root `README.md` focused on project overview and first-run commands.
- Keep run/operate details in `docs/runbook/`.
- Keep demo proof steps in `docs/demo/`.
- Keep API details in `docs/api/` and `docs/api/openapi.yaml`.
- Keep Docker, Kubernetes and observability details near their owning folders.
- Do not keep stale planning or completed backlog documents in the root.
