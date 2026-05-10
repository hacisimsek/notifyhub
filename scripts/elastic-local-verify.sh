#!/usr/bin/env bash
set -euo pipefail

ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
LOGSTASH_URL="${LOGSTASH_URL:-http://localhost:9600}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-180}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_http() {
  local label="$1"
  local url="$2"
  local elapsed=0

  until curl --fail --silent --show-error "${url}" >/dev/null; do
    if (( elapsed >= TIMEOUT_SECONDS )); then
      echo "${label} did not become ready at ${url}" >&2
      exit 1
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
}

json_number() {
  node -e '
const fs = require("fs");
const path = process.argv[1].split(".");
let value = JSON.parse(fs.readFileSync(0, "utf8"));
for (const segment of path) {
  value = value?.[segment];
}
if (typeof value !== "number") {
  process.exit(1);
}
process.stdout.write(String(value));
' "$1"
}

data_view_exists() {
  node -e '
const fs = require("fs");
const title = process.argv[1];
const body = JSON.parse(fs.readFileSync(0, "utf8"));
const dataViews = body.data_view ?? body.dataViews ?? [];
process.exit(dataViews.some((dataView) => dataView.title === title) ? 0 : 1);
' "$1"
}

require_command curl
require_command node

wait_for_http "Elasticsearch" "${ELASTICSEARCH_URL}/_cluster/health?wait_for_status=yellow&timeout=5s"
wait_for_http "Kibana" "${KIBANA_URL}/api/status"
wait_for_http "Logstash" "${LOGSTASH_URL}/_node/pipelines/main"

curl --fail --silent --show-error "${GATEWAY_URL}/actuator/health" >/dev/null

elapsed=0
while (( elapsed < TIMEOUT_SECONDS )); do
  search_response="$(
    curl --fail --silent --show-error \
      -X POST "${ELASTICSEARCH_URL}/logs-notifyhub-local/_search?ignore_unavailable=true" \
      -H "Content-Type: application/json" \
      --data '{"size":0,"track_total_hits":true}'
  )"
  hit_count="$(printf '%s' "${search_response}" | json_number "hits.total.value" || true)"
  if [[ -n "${hit_count}" && "${hit_count}" != "0" ]]; then
    break
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

if [[ -z "${hit_count:-}" || "${hit_count}" == "0" ]]; then
  echo "No NotifyHub logs were indexed into logs-notifyhub-local within ${TIMEOUT_SECONDS}s" >&2
  exit 1
fi

data_views_response="$(
  curl --fail --silent --show-error \
    "${KIBANA_URL}/api/data_views" \
    -H "kbn-xsrf: notifyhub"
)"

if ! printf '%s' "${data_views_response}" | data_view_exists "logs-notifyhub-*"; then
  data_view_response_file="$(mktemp)"
  data_view_status="$(
    curl --silent --show-error \
      -o "${data_view_response_file}" \
      -w "%{http_code}" \
      -X POST "${KIBANA_URL}/api/data_views/data_view" \
      -H "kbn-xsrf: notifyhub" \
      -H "Content-Type: application/json" \
      --data '{"data_view":{"title":"logs-notifyhub-*","name":"NotifyHub Logs","timeFieldName":"@timestamp"}}'
  )"

  if [[ "${data_view_status}" != "200" && "${data_view_status}" != "409" ]]; then
    data_views_response="$(
      curl --fail --silent --show-error \
        "${KIBANA_URL}/api/data_views" \
        -H "kbn-xsrf: notifyhub"
    )"
    if ! printf '%s' "${data_views_response}" | data_view_exists "logs-notifyhub-*"; then
      echo "Kibana data view creation returned HTTP ${data_view_status}" >&2
      cat "${data_view_response_file}" >&2
      rm -f "${data_view_response_file}"
      exit 1
    fi
  fi
  rm -f "${data_view_response_file}"
fi

echo "Elastic local logging verified."
echo "Indexed NotifyHub log events: ${hit_count}"
echo "Elasticsearch: ${ELASTICSEARCH_URL}"
echo "Kibana: ${KIBANA_URL} (data view: logs-notifyhub-*)"
