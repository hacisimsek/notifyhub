#!/usr/bin/env bash
# Starts NotifyHub on Minikube (inside a GitHub Codespace or any Docker host) and exposes the dashboard and Grafana.
# Safe to rerun: it reuses the cluster, the secrets and already built images.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SECRETS_FILE="${REPO_ROOT}/deploy/k8s/base/secrets.env"
NAMESPACE="notifyhub"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"

cd "${REPO_ROOT}"

if [[ ! -f "${SECRETS_FILE}" ]]; then
  # The demo URLs are public, so never run with the example passwords.
  random() { openssl rand -hex 24; }
  sed -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(random)/" \
      -e "s/^AUTH_JWT_SECRET=.*/AUTH_JWT_SECRET=$(random)$(random)/" \
      -e "s/^INTERNAL_SERVICE_TOKEN=.*/INTERNAL_SERVICE_TOKEN=$(random)/" \
      -e "s/^RABBITMQ_PASSWORD=.*/RABBITMQ_PASSWORD=$(random)/" \
      -e "s/^GRAFANA_ADMIN_PASSWORD=.*/GRAFANA_ADMIN_PASSWORD=$(random)/" \
      deploy/k8s/base/secrets.env.example > "${SECRETS_FILE}"
  chmod 600 "${SECRETS_FILE}"
  echo "Generated ${SECRETS_FILE} with random secrets."
fi

if ! minikube status >/dev/null 2>&1; then
  minikube start --driver=docker --container-runtime=docker --cpus=4 --memory=6g
fi

build_images=true
if [[ "${REBUILD:-false}" != "true" ]] && minikube image ls 2>/dev/null | grep -q "notifyhub/dashboard:local"; then
  build_images=false
  echo "Reusing images already built in Minikube (set REBUILD=true to rebuild)."
fi
BUILD_IMAGES="${build_images}" RUN_SMOKE="${RUN_SMOKE:-true}" "${SCRIPT_DIR}/k8s-local-verify.sh"

# Keep the forwards alive across pod restarts; --address 0.0.0.0 lets Codespaces publish them.
pkill -f "kubectl -n ${NAMESPACE} port-forward" 2>/dev/null || true
forward() {
  nohup bash -c "while true; do kubectl -n ${NAMESPACE} port-forward --address 0.0.0.0 service/$1 $2:$3; sleep 2; done" \
    >"/tmp/notifyhub-forward-$1.log" 2>&1 &
}
forward dashboard "${DASHBOARD_PORT}" 80
forward grafana "${GRAFANA_PORT}" 3000

if [[ -n "${CODESPACE_NAME:-}" ]]; then
  domain="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  if ! gh codespace ports visibility "${DASHBOARD_PORT}:public" "${GRAFANA_PORT}:public" -c "${CODESPACE_NAME}" >/dev/null 2>&1; then
    echo "Could not make ports public automatically: in the PORTS tab, right-click ${DASHBOARD_PORT} and ${GRAFANA_PORT} > Port Visibility > Public."
  fi
  echo "Dashboard: https://${CODESPACE_NAME}-${DASHBOARD_PORT}.${domain}"
  echo "Grafana:   https://${CODESPACE_NAME}-${GRAFANA_PORT}.${domain}"
else
  echo "Dashboard: http://localhost:${DASHBOARD_PORT}"
  echo "Grafana:   http://localhost:${GRAFANA_PORT}"
fi
echo "Grafana login: GRAFANA_ADMIN_USER / GRAFANA_ADMIN_PASSWORD in deploy/k8s/base/secrets.env"
kubectl -n "${NAMESPACE}" get pods
