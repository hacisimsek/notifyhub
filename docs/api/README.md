# API Notes

This directory holds the OpenAPI reference, example requests and service-specific API notes for the current MVP surface.

OpenAPI reference: [openapi.yaml](./openapi.yaml)

External clients should call the Gateway Service on port `8080`. The service-specific notes below describe the exposed API shape; internally, the gateway forwards authenticated requests to backend services and propagates identity with `X-User-Id`, `X-User-Email`, and `X-User-Role`.

API groups:

- Auth API
- Reminder API
- Notification API
- Gateway routes

## Gateway Routes

Gateway Service is the public entry point for browser and script clients. It forwards auth routes directly to Auth Service and forwards authenticated reminder and notification routes with propagated identity headers.

| Method | Path | Auth | Target |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Auth Service |
| `POST` | `/api/auth/login` | No | Auth Service |
| `GET` | `/api/auth/me` | Bearer token | Auth Service |
| `POST` | `/api/reminders` | Bearer token | Reminder Service |
| `GET` | `/api/reminders` | Bearer token | Reminder Service |
| `GET` | `/api/reminders/{id}` | Bearer token | Reminder Service |
| `PUT` | `/api/reminders/{id}` | Bearer token | Reminder Service |
| `DELETE` | `/api/reminders/{id}` | Bearer token | Reminder Service |
| `GET` | `/api/notifications` | Bearer token | Notification Service |

Gateway health is available at `GET /actuator/health`.

## Validation

API documentation changes are checked by API Docs CI, which parses `docs/api/openapi.yaml` as YAML.

## Auth API

Base path: `/api/auth`

### Register

`POST /api/auth/register`

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Returns `201 Created` with a bearer access token and user summary.

Example response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresAt": "2026-05-02T15:00:00Z",
  "user": {
    "id": "018f1757-0aa5-7a6a-9a33-e78995f25a21",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Returns `200 OK` with a bearer access token and user summary.

### Current User

`GET /api/auth/me`

Requires `Authorization: Bearer <token>`.

## Reminder API

Base path: `/api/reminders`

The current service boundary expects `X-User-Id: <uuid>` from the gateway. Direct local calls must include this header.

### Create Reminder

`POST /api/reminders`

```json
{
  "title": "Pay invoice",
  "message": "Invoice is due tomorrow",
  "scheduledFor": "2026-05-04T10:00:00Z",
  "channel": "EMAIL",
  "recipient": "user@example.com"
}
```

Supported channels are `EMAIL`, `SMS` and `PUSH`. `recipient` is channel-specific: email address, phone number, or push target identifier.

### List Reminders

`GET /api/reminders`

Returns reminders for the current owner ordered by scheduled time.

Optional query filters:

- `status`: `SCHEDULED`, `TRIGGERED` or `CANCELLED`
- `channel`: `EMAIL`, `SMS` or `PUSH`

Example:

```text
GET /api/reminders?status=SCHEDULED&channel=EMAIL
```

### Update Reminder

`PUT /api/reminders/{id}`

Uses the same body shape as create.

### Delete Reminder

`DELETE /api/reminders/{id}`

Cancels the reminder and returns `204 No Content`.

## Notification API

Base paths:

- `/internal/notifications` for service-to-service delivery work.
- `/api/notifications` for user delivery history.

The public history endpoint expects `X-User-Id: <uuid>` from the gateway. Direct local calls must include this header.

### Create Notification Work

`POST /internal/notifications`

```json
{
  "userId": "018f1757-0aa5-7a6a-9a33-e78995f25a21",
  "reminderId": "018f1757-0aa5-7a6a-9a33-e78995f25a23",
  "channel": "EMAIL",
  "recipient": "user@example.com",
  "subject": "Invoice due",
  "message": "Invoice is due tomorrow",
  "idempotencyKey": "invoice-due-2026-05-04"
}
```

The current adapter is mock delivery. Successful mock dispatch moves the log from `PENDING` to `SENT`.
Each delivery run writes a delivery attempt record and updates `attemptCount` plus `lastAttemptAt` on the notification response.

## Messaging

Due reminders are published to Kafka topic `reminder.triggered`. Notification Service consumes this event, creates notification work with the event idempotency key, and dispatches through the configured channel adapter.

### List Notification History

`GET /api/notifications`

Returns notification logs ordered by creation time. Each item includes final status fields and attempt summary fields:

- `attemptCount`
- `lastAttemptAt`
- `failureReason`

Optional query filters:

- `status`: `PENDING`, `SENT`, `FAILED` or `RETRYING`
- `channel`: `EMAIL`, `SMS` or `PUSH`

Example:

```text
GET /api/notifications?status=SENT&channel=EMAIL
```

Example response item:

```json
{
  "id": "018f1757-0aa5-7a6a-9a33-e78995f25a30",
  "userId": "018f1757-0aa5-7a6a-9a33-e78995f25a21",
  "reminderId": "018f1757-0aa5-7a6a-9a33-e78995f25a23",
  "channel": "EMAIL",
  "recipient": "user@example.com",
  "subject": "Invoice due",
  "message": "Invoice is due tomorrow",
  "status": "SENT",
  "failureReason": null,
  "idempotencyKey": "invoice-due-2026-05-04",
  "attemptCount": 1,
  "createdAt": "2026-05-02T13:00:00Z",
  "lastAttemptAt": "2026-05-02T13:00:01Z",
  "updatedAt": "2026-05-02T13:00:01Z",
  "sentAt": "2026-05-02T13:00:01Z"
}
```
