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
