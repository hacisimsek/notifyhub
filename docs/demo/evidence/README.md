# Demo Evidence

Captured on 2026-10-17 against `main` at `2455c86`, following [the demo guide](../README.md).

## Release Gates

| Gate | Command | Result |
|---|---|---|
| Final verification | `./scripts/final-verify.sh` | Passed: backend `mvn verify`, 25 dashboard tests, dashboard build, YAML/OpenAPI/kustomize/Compose checks |
| Compose stack e2e | `./scripts/local-stack-e2e.sh` | Passed: `Gateway e2e smoke passed`, `Local stack e2e smoke passed at http://localhost:8080` |
| Kubernetes | `./scripts/k8s-local-verify.sh` | Passed on Minikube 1.39 (`--container-runtime=docker --cpus=4 --memory=6g`): 11 deployments rolled out, gateway e2e smoke passed |

## Manual Dashboard Demo

The dashboard ran on port `3002` (`DASHBOARD_PORT=3002`) because another local app was using `3000`.

| Step | Evidence |
|---|---|
| Register a new user; session starts in an HttpOnly cookie | [01-register.jpg](01-register.jpg), [02-overview-after-login.jpg](02-overview-after-login.jpg) |
| Create an `EMAIL` reminder about a minute ahead | [03-reminder-created.jpg](03-reminder-created.jpg) |
| Create a second reminder for `demo+fail@example.com`; list shows newest first | [04-two-reminders-scheduled.jpg](04-two-reminders-scheduled.jpg) |
| Scheduler triggers both reminders | [05-reminders-triggered.jpg](05-reminders-triggered.jpg) |
| Reminder filters: status `Triggered`, channel `EMAIL` | [06-reminder-filters-triggered-email.jpg](06-reminder-filters-triggered-email.jpg) |
| History: normal reminder `SENT` after 1 attempt; `+fail` reminder `FAILED` after 3 attempts | [07-history-sent-and-failed.jpg](07-history-sent-and-failed.jpg) |
| History filter: status `Failed` | [08-history-filter-failed.jpg](08-history-filter-failed.jpg) |
| Prometheus: all backend scrape targets `UP` | [09-prometheus-targets-up.jpg](09-prometheus-targets-up.jpg) |
| Grafana `NotifyHub Overview`: gateway up, request rate, latency, heap, no 5xx | [10-grafana-service-overview.jpg](10-grafana-service-overview.jpg) |
| Grafana delivery panels: 4 `EMAIL` attempts (1 sent, 2 retrying, 1 failed) | [11-grafana-delivery-panels.jpg](11-grafana-delivery-panels.jpg) |

RabbitMQ after the run (management API):

```text
notifyhub.notifications.delivery        ready=0
notifyhub.notifications.delivery.retry  ready=0
notifyhub.notifications.delivery.dlq    ready=1   {"notificationId":"99a1acf7-…","attempt":3,…}
```

## Gateway CORS and Session Checks

Run against the live Compose stack through the dashboard nginx proxy:

| Request | Result |
|---|---|
| Register through `http://localhost:3002/api` with `Origin: http://localhost:3002` | `201`, `NOTIFYHUB_SESSION` cookie set |
| Create, list and delete a reminder with the cookie and `X-NotifyHub-Client` | `201`, list returns it, `204` |
| Cookie without `X-NotifyHub-Client` | `401` (CSRF guard) |
| Direct Gateway call with `Origin: http://evil.test` | `403`, no `Access-Control-Allow-Origin` |
| Direct Gateway call with `Origin: http://localhost:5173` | `200`, `Access-Control-Allow-Origin: http://localhost:5173` |
