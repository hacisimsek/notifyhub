#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
EMAIL="${SMOKE_EMAIL:-smoke-$(date +%s)-$$@example.com}"
PASSWORD="${SMOKE_PASSWORD:-secret123}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-90}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

json_value() {
  node -e '
const fs = require("fs");
const path = process.argv[1].split(".");
let value = JSON.parse(fs.readFileSync(0, "utf8"));
for (const segment of path) {
  value = value?.[segment];
}
if (value === undefined || value === null) {
  process.exit(1);
}
process.stdout.write(String(value));
' "$1"
}

find_notification_status() {
  node -e '
const fs = require("fs");
const reminderId = process.argv[1];
const notifications = JSON.parse(fs.readFileSync(0, "utf8"));
const item = notifications.find((notification) => notification.reminderId === reminderId);
if (!item) {
  process.exit(2);
}
process.stdout.write(String(item.status));
' "$1"
}

wait_for_gateway() {
  local elapsed=0
  until curl --fail --silent --show-error "${BASE_URL}/actuator/health" >/dev/null; do
    if (( elapsed >= TIMEOUT_SECONDS )); then
      echo "Gateway did not become healthy at ${BASE_URL}" >&2
      exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
}

require_command curl
require_command node

wait_for_gateway

register_response="$(
  curl --fail --silent --show-error \
    -X POST "${BASE_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
)"

access_token="$(printf '%s' "${register_response}" | json_value "accessToken")"
user_id="$(printf '%s' "${register_response}" | json_value "user.id")"

me_response="$(
  curl --fail --silent --show-error \
    "${BASE_URL}/api/auth/me" \
    -H "Authorization: Bearer ${access_token}"
)"
me_user_id="$(printf '%s' "${me_response}" | json_value "id")"

if [[ "${user_id}" != "${me_user_id}" ]]; then
  echo "Authenticated user mismatch: registered=${user_id}, me=${me_user_id}" >&2
  exit 1
fi

scheduled_for="$(node -e 'console.log(new Date(Date.now() + 15000).toISOString())')"
reminder_response="$(
  curl --fail --silent --show-error \
    -X POST "${BASE_URL}/api/reminders" \
    -H "Authorization: Bearer ${access_token}" \
    -H "Content-Type: application/json" \
    --data "{\"title\":\"Smoke reminder\",\"message\":\"Gateway e2e smoke\",\"scheduledFor\":\"${scheduled_for}\",\"channel\":\"EMAIL\",\"recipient\":\"${EMAIL}\"}"
)"
reminder_id="$(printf '%s' "${reminder_response}" | json_value "id")"

curl --fail --silent --show-error \
  "${BASE_URL}/api/reminders" \
  -H "Authorization: Bearer ${access_token}" \
  | node -e '
const fs = require("fs");
const reminderId = process.argv[1];
const reminders = JSON.parse(fs.readFileSync(0, "utf8"));
if (!reminders.some((reminder) => reminder.id === reminderId)) {
  process.exit(1);
}
' "${reminder_id}"

elapsed=0
notification_status=""
while (( elapsed < TIMEOUT_SECONDS )); do
  notifications="$(
    curl --fail --silent --show-error \
      "${BASE_URL}/api/notifications" \
      -H "Authorization: Bearer ${access_token}"
  )"
  notification_status="$(printf '%s' "${notifications}" | find_notification_status "${reminder_id}" 2>/dev/null || true)"
  if [[ "${notification_status}" == "SENT" ]]; then
    echo "Gateway e2e smoke passed for ${EMAIL}"
    exit 0
  fi

  sleep 3
  elapsed=$((elapsed + 3))
done

echo "Notification was not delivered for reminder ${reminder_id}; last status: ${notification_status:-not found}" >&2
exit 1
