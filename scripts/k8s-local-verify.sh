#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NAMESPACE="${NAMESPACE:-notifyhub}"
KUSTOMIZE_DIR="${KUSTOMIZE_DIR:-${REPO_ROOT}/deploy/k8s/base}"
BUILD_IMAGES="${BUILD_IMAGES:-true}"
APPLY_MANIFESTS="${APPLY_MANIFESTS:-true}"
RUN_SMOKE="${RUN_SMOKE:-true}"
TEARDOWN="${TEARDOWN:-false}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-420s}"
GATEWAY_LOCAL_PORT="${GATEWAY_LOCAL_PORT:-18080}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-180}"
PORT_FORWARD_PID=""

DEPLOYMENTS=(
  postgres
  redis
  rabbitmq
  kafka
  auth-service
  reminder-service
  notification-service
  gateway-service
  dashboard
  prometheus
  grafana
)

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "${PORT_FORWARD_PID}" ]]; then
    kill "${PORT_FORWARD_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "${TEARDOWN}" == "true" ]]; then
    kubectl delete -k "${KUSTOMIZE_DIR}" --ignore-not-found=true
  fi
}

build_backend_image() {
  local service_module="$1"
  docker build \
    -t "notifyhub/${service_module}:local" \
    --build-arg "SERVICE_MODULE=${service_module}" \
    -f backend/Dockerfile \
    .
}

wait_for_gateway_forward() {
  local base_url="http://127.0.0.1:${GATEWAY_LOCAL_PORT}"
  local elapsed=0
  until curl --fail --silent --show-error "${base_url}/actuator/health" >/dev/null; do
    if (( elapsed >= 60 )); then
      echo "Gateway port-forward did not become healthy at ${base_url}" >&2
      exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
}

require_command kubectl
require_command minikube

if [[ "${BUILD_IMAGES}" == "true" ]]; then
  require_command docker
fi

if [[ "${RUN_SMOKE}" == "true" ]]; then
  require_command curl
  require_command node
fi

cd "${REPO_ROOT}"

if ! minikube status >/dev/null 2>&1; then
  echo "Minikube is not running. Start it with 'minikube start', then rerun this script." >&2
  exit 1
fi

kubectl kustomize "${KUSTOMIZE_DIR}" >/dev/null

trap cleanup EXIT

if [[ "${BUILD_IMAGES}" == "true" ]]; then
  eval "$(minikube docker-env)"
  build_backend_image auth-service
  build_backend_image reminder-service
  build_backend_image notification-service
  build_backend_image gateway-service
  docker build -t notifyhub/dashboard:local -f web/dashboard/Dockerfile .
fi

if [[ "${APPLY_MANIFESTS}" == "true" ]]; then
  kubectl apply -k "${KUSTOMIZE_DIR}"
  for deployment in "${DEPLOYMENTS[@]}"; do
    kubectl -n "${NAMESPACE}" rollout status "deployment/${deployment}" --timeout="${WAIT_TIMEOUT}"
  done
fi

if [[ "${RUN_SMOKE}" == "true" ]]; then
  kubectl -n "${NAMESPACE}" port-forward service/gateway-service "${GATEWAY_LOCAL_PORT}:8080" >/tmp/notifyhub-gateway-port-forward.log 2>&1 &
  PORT_FORWARD_PID="$!"
  wait_for_gateway_forward
  BASE_URL="http://127.0.0.1:${GATEWAY_LOCAL_PORT}" \
  SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS}" \
    "${SCRIPT_DIR}/gateway-e2e-smoke.sh"
fi

echo "Kubernetes local verification completed for namespace ${NAMESPACE}"
