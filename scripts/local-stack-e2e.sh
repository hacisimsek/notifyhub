#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${ENV_FILE:-${REPO_ROOT}/deploy/docker/.env}"
ENV_EXAMPLE_FILE="${ENV_EXAMPLE_FILE:-${REPO_ROOT}/deploy/docker/.env.example}"
COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/deploy/docker/compose.yml}"
BASE_URL="${BASE_URL:-http://localhost:8080}"
RESET_STACK="${RESET_STACK:-false}"
TEARDOWN="${TEARDOWN:-false}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-180}"
STACK_STARTED=false

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

docker_ready() {
  docker info >/dev/null 2>&1
}

cleanup() {
  if [[ "${TEARDOWN}" == "true" && "${STACK_STARTED}" == "true" ]] && docker_ready; then
    compose down
  fi
}

require_command docker
require_command curl
require_command node

cd "${REPO_ROOT}"

if ! docker_ready; then
  echo "Docker daemon is not reachable. Start Docker Desktop, then rerun this script." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
fi

trap cleanup EXIT

if [[ "${RESET_STACK}" == "true" ]]; then
  compose down --volumes --remove-orphans
fi

compose up --build -d
STACK_STARTED=true

BASE_URL="${BASE_URL}" \
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS}" \
  "${SCRIPT_DIR}/gateway-e2e-smoke.sh"

echo "Local stack e2e smoke passed at ${BASE_URL}"
