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
