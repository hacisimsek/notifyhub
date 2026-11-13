# Local Kubernetes

These manifests provide a local Minikube deployment for NotifyHub.

## One-command Verification

Start Minikube with the Docker runtime. The script builds images through `minikube docker-env`, and Minikube 1.39+ defaults to containerd:

```bash
minikube start --driver=docker --container-runtime=docker --cpus=4 --memory=6g
```

Then, from the repository root:

```bash
./scripts/k8s-local-verify.sh
```

The script builds local images inside the Minikube Docker daemon, applies `deploy/k8s/base`, waits for all deployments to roll out, port-forwards Gateway Service and runs the gateway e2e smoke check.

Useful options:

- `BUILD_IMAGES=false ./scripts/k8s-local-verify.sh` skips image builds when images already exist in Minikube.
- `RUN_SMOKE=false ./scripts/k8s-local-verify.sh` applies and waits for rollouts without running the API smoke flow.
- `TEARDOWN=true ./scripts/k8s-local-verify.sh` deletes the local manifests when the script exits.
- `GATEWAY_LOCAL_PORT=18081 ./scripts/k8s-local-verify.sh` changes the local Gateway port-forward.

## Build Local Images

Build images inside the Minikube Docker daemon from the repository root:

```bash
eval "$(minikube docker-env)"
docker build -t notifyhub/auth-service:local --build-arg SERVICE_MODULE=auth-service -f backend/Dockerfile .
docker build -t notifyhub/reminder-service:local --build-arg SERVICE_MODULE=reminder-service -f backend/Dockerfile .
docker build -t notifyhub/notification-service:local --build-arg SERVICE_MODULE=notification-service -f backend/Dockerfile .
docker build -t notifyhub/gateway-service:local --build-arg SERVICE_MODULE=gateway-service -f backend/Dockerfile .
docker build -t notifyhub/dashboard:local -f web/dashboard/Dockerfile .
```

## Apply

```bash
kubectl apply -k deploy/k8s/base
kubectl -n notifyhub get pods
```

Wait for rollouts:

```bash
kubectl -n notifyhub rollout status deployment/postgres
kubectl -n notifyhub rollout status deployment/auth-service
kubectl -n notifyhub rollout status deployment/reminder-service
kubectl -n notifyhub rollout status deployment/notification-service
kubectl -n notifyhub rollout status deployment/gateway-service
kubectl -n notifyhub rollout status deployment/dashboard
```

Secrets are generated from `deploy/k8s/base/secrets.env`, which is git-ignored. Create it from the example and replace every value before applying the manifests:

```bash
cp deploy/k8s/base/secrets.env.example deploy/k8s/base/secrets.env
```

`./scripts/k8s-local-verify.sh` copies the example automatically when the file is missing, which is only suitable for local testing.

## Resources

Every container sets CPU and memory requests and limits. Requests total about 1.7 CPU and 3.3 GiB, which fits the Minikube size above.

| Workload | Request (CPU / memory) | Limit (CPU / memory) |
|---|---|---|
| Auth, Reminder, Notification, Gateway (each) | 250m / 384Mi | 1 / 768Mi |
| Kafka (heap set to 512m) | 250m / 768Mi | 1 / 1Gi |
| PostgreSQL, RabbitMQ | 100m / 256Mi | 1 / 512Mi |
| Prometheus | 100m / 256Mi | 500m / 512Mi |
| Grafana | 50m / 128Mi | 500m / 256Mi |
| Redis | 50m / 64Mi | 250m / 256Mi |
| Dashboard, Alertmanager | 25m / 32Mi | 200m and 100m / 128Mi |

The Java services set no explicit heap, so the JVM uses 25% of the memory limit. In a local run the Java services used 270–345 MiB of their 768 MiB limit and Kafka used 330 MiB of 1 GiB, with no restarts.

## Access

```bash
minikube service -n notifyhub dashboard
minikube service -n notifyhub gateway-service
minikube service -n notifyhub prometheus
minikube service -n notifyhub grafana
```

Grafana credentials are `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` from `deploy/k8s/base/secrets.env`.
