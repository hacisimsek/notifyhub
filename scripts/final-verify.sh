#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RUN_BACKEND="${RUN_BACKEND:-true}"
RUN_DASHBOARD="${RUN_DASHBOARD:-true}"
RUN_STATIC="${RUN_STATIC:-true}"
RUN_FULL_STACK="${RUN_FULL_STACK:-false}"
RUN_K8S="${RUN_K8S:-false}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_step() {
  local label="$1"
  shift
  echo
  echo "==> ${label}"
  "$@"
}

parse_k8s_yaml() {
  ruby -e 'require "yaml"; ARGV.each { |file| YAML.load_stream(File.read(file)); puts file }' deploy/k8s/base/*.yaml
}

render_kustomize() {
  local output_file="${TMPDIR:-/tmp}/notifyhub-kustomize-render.yaml"
  kubectl kustomize deploy/k8s/base > "${output_file}"
  wc -l "${output_file}"
}

cd "${REPO_ROOT}"

if [[ "${RUN_BACKEND}" == "true" ]]; then
  require_command mvn
  run_step "Backend verify" mvn -B -ntp -f backend/pom.xml verify
fi

if [[ "${RUN_DASHBOARD}" == "true" ]]; then
  require_command npm
  run_step "Dashboard tests" npm run test --prefix web/dashboard
  run_step "Dashboard production build" npm run build --prefix web/dashboard
fi

if [[ "${RUN_STATIC}" == "true" ]]; then
  require_command bash
  require_command docker
  require_command kubectl
  require_command ruby

  run_step "Shell syntax" bash -n \
    scripts/smoke-check.sh \
    scripts/gateway-e2e-smoke.sh \
    scripts/local-stack-e2e.sh \
    scripts/k8s-local-verify.sh \
    scripts/final-verify.sh
  run_step "OpenAPI YAML parse" ruby -e 'require "yaml"; YAML.load_file("docs/api/openapi.yaml"); puts "docs/api/openapi.yaml"'
  run_step "Kubernetes YAML parse" parse_k8s_yaml
  run_step "Kubernetes kustomize render" render_kustomize
  run_step "Docker Compose render" docker compose --env-file deploy/docker/.env.example -f deploy/docker/compose.yml config --services
  run_step "Git whitespace check" git diff --check
fi

if [[ "${RUN_FULL_STACK}" == "true" ]]; then
  run_step "Docker Compose e2e" "${SCRIPT_DIR}/local-stack-e2e.sh"
fi

if [[ "${RUN_K8S}" == "true" ]]; then
  run_step "Kubernetes local e2e" "${SCRIPT_DIR}/k8s-local-verify.sh"
fi

echo
echo "Final verification completed."
