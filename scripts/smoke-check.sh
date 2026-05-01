#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

curl --fail --silent --show-error "${BASE_URL}/actuator/health" >/dev/null

echo "Gateway health check passed at ${BASE_URL}"
