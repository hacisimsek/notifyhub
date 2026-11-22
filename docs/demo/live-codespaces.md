# Live Demo on GitHub Codespaces

Runs the full Kubernetes deployment (Minikube) in a free GitHub Codespace and publishes the dashboard and Grafana on public HTTPS URLs, so the demo can be opened from any machine.

Cost: a personal GitHub account includes 120 core hours per month. The 4-core machine uses 4 core hours per running hour, so about 30 hours. A stopped codespace uses only storage quota. When the quota runs out, Codespaces stops; nothing is charged unless a payment method and spending limit are set.

## Day Before: Dry Run

1. On github.com, open **Settings → Codespaces** and set **Default idle timeout** to `240` minutes.
2. In the repository, open **Code → Codespaces → ⋯ → New with options**, select branch `main` and machine type **4-core / 16 GB**, then **Create codespace**. The `.devcontainer` installs Docker, Minikube, kubectl, Node and the GitHub CLI.
3. In the codespace terminal:

   ```bash
   ./scripts/codespaces-demo.sh
   ```

   The first run starts Minikube, builds the five images, applies `deploy/k8s/base`, waits for 12 deployments, runs the API smoke test and prints the public URLs. It generates `deploy/k8s/base/secrets.env` with random secrets on first use.
4. If the script could not change the port visibility, open the **PORTS** tab, right-click ports `3000` and `3001` and set **Port Visibility → Public**.
5. Open the dashboard URL on the presentation machine and on a phone. Register a user and create a reminder.
6. Stop the codespace: **Code → Codespaces → ⋯ → Stop codespace**. Minikube, built images and data stay on its disk.

## Presentation Day

1. About 20 minutes before, start the codespace from **Code → Codespaces**.
2. Run `./scripts/codespaces-demo.sh` again. It reuses the cluster and images (`REBUILD=true` forces a rebuild).
3. Open the printed URLs and check `kubectl -n notifyhub get pods`.

## Demo Flow

- `kubectl -n notifyhub get deploy,pods,svc` shows 12 workloads with resource requests and limits.
- In the dashboard: register, log in, create an EMAIL reminder one minute ahead, watch the departures board, then the delivery log.
- Create a reminder for `demo+fail@example.com` to show retries and the dead-letter queue, then the `NotifyHubDeliveryDLQ` alert in Grafana.
- Load test from the codespace terminal while Grafana is open:

  ```bash
  kubectl -n notifyhub port-forward service/gateway-service 18080:8080 &
  BASE_URL=http://127.0.0.1:18080 REQUESTS=2000 CONCURRENCY=50 node scripts/performance-smoke.mjs
  ```

## Optional Live Email and Push

Add these to `deploy/k8s/base/secrets.env` and rerun `./scripts/codespaces-demo.sh`:

```text
NOTIFICATION_LIVE_RECIPIENTS=you@gmail.com,notifyhub-demo-<random>
NOTIFICATION_SMTP_HOST=smtp.gmail.com
NOTIFICATION_SMTP_USERNAME=you@gmail.com
NOTIFICATION_SMTP_PASSWORD=<Google app password>
```

Only the listed recipients get real email or ntfy push; everything else stays mocked. See `deploy/production/README.md` for the Gmail app password and ntfy topic setup.

## After the Demo

Delete the codespace (**⋯ → Delete**) so it stops using storage quota.

## Fallbacks

- Corporate networks may block `*.app.github.dev`. Test from the presentation machine during the dry run; if it is blocked, present from a laptop browser signed in to the codespace or run the local Compose stack.
- If a pod restarts, the port-forward loop reconnects within a few seconds.
