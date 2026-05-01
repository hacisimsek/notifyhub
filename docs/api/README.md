# API Notes

This directory will hold OpenAPI references, example requests and service-specific API notes.

Planned API groups:

- Auth API
- Reminder API
- Notification API
- Gateway routes

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

### Update Reminder

`PUT /api/reminders/{id}`

Uses the same body shape as create.

### Delete Reminder

`DELETE /api/reminders/{id}`

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

## Messaging

Due reminders are published to Kafka topic `reminder.triggered`. Notification Service consumes this event, creates notification work with the event idempotency key, and dispatches through the configured channel adapter.

### List Notification History

`GET /api/notifications`
