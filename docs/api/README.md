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
  "channel": "EMAIL"
}
```

Supported channels are `EMAIL`, `SMS` and `PUSH`.

### List Reminders

`GET /api/reminders`

Returns reminders for the current owner ordered by scheduled time.

### Update Reminder

`PUT /api/reminders/{id}`

Uses the same body shape as create.

### Delete Reminder

`DELETE /api/reminders/{id}`
