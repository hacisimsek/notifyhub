# Local Kubernetes

These manifests provide a local Minikube deployment for NotifyHub.

## One-command Verification

From the repository root, with Minikube running:

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

The manifests include local development secrets with placeholder values. Replace `deploy/k8s/base/secrets.example.yaml` values before using this outside a local demo.

## Access

```bash
minikube service -n notifyhub dashboard
minikube service -n notifyhub gateway-service
minikube service -n notifyhub prometheus
minikube service -n notifyhub grafana
```

Grafana local credentials:

- Username: `admin`
- Password: `notifyhub`
