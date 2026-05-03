# NotifyHub Dashboard

React + Vite dashboard for the local NotifyHub API.

## Docker Compose

The local Docker stack builds and serves the dashboard through Nginx:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build dashboard
```

Run the command from the repository root. The container serves the UI at `http://localhost:3000` and proxies `/api` requests to the Gateway Service inside the Compose network.

## Local Development

Start the backend stack first:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yml up --build
```

Then run the dashboard:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8080`.

## Auth Workflow

The dashboard supports register, login, current-user lookup and password changes through the Gateway API. Signed-in users manage account details and password changes from the Profile page; successful password changes refresh the stored bearer token without signing the user out.

The main authenticated sections are split by responsibility: Overview contains runtime metrics, service topology and live event stream; Reminders contains reminder create/manage workflows; History contains delivery logs; Profile contains account settings.
