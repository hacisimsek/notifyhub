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

The dashboard supports register, login, current-user lookup, profile updates, localized UI text and password changes through the Gateway API. Registration asks for first name, last name and phone number in addition to email and password. The UI defaults to the browser language for Turkish or English, fetches labels and known error-code messages from `/api/i18n/messages`, and lets signed-in users persist their preferred language from the Profile page. Successful profile or password changes refresh the stored bearer token without signing the user out.

The main authenticated sections are split by responsibility: Overview contains runtime metrics, service topology and live event stream; Reminders contains reminder create/manage workflows; History contains delivery logs; Profile contains account settings.
