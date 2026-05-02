# Local Kubernetes

These manifests provide a local Minikube deployment for NotifyHub.

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
