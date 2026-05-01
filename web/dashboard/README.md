# NotifyHub Dashboard

React + Vite dashboard for the local NotifyHub API.

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
