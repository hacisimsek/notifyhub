# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The project owner presenting NotifyHub live (projector or screen share) during the project demo, and the reviewers watching it. Secondary: a developer or operator who signs in to create reminders and check delivery.

## Product Purpose

NotifyHub schedules one-time reminders and delivers them as EMAIL, SMS or PUSH notifications. The dashboard lets a signed-in user create, edit, filter and delete reminders, follow each reminder through the delivery pipeline, and read delivery history including retries and failures.

## Positioning

The dashboard shows the asynchronous pipeline itself: reminder scheduled, triggered through Kafka, queued in RabbitMQ, retried, delivered or dead-lettered. Each reminder's journey is visible, not only its final status.

## Operating Context

- Served by nginx at `http://localhost:3000` in Docker Compose, by Vite on `5173` in development; `/api` is proxied to the Gateway.
- Session is an HttpOnly cookie; the UI never sees the token.
- Data refreshes on demand and polls every 5 s while work is pending.
- The mock sender fails recipients containing `+fail`, which demonstrates retry and DLQ live.

## Capabilities and Constraints

- Views: Overview, Reminders, History, Profile (hash routes), command palette (Cmd/Ctrl+K), payload inspector.
- English and Turkish UI text; labels come from `/api/i18n/messages` with built-in English fallbacks.
- Light and dark themes; light is the default.
- Strict CSP: no external fonts, scripts or images. Only `lucide-react` icons are available.
- Existing tests query by visible headings, labels and roles; those names are part of the contract.

## Brand Commitments

Name `NotifyHub`. No logo asset exists; the bell icon is the mark.

## Evidence on Hand

No real customer data. Screenshots and demo data are synthetic and come from the local stack or a mock API.

## Product Principles

- Show the pipeline, not just the record.
- Readable from the back of a room: large times, clear states, no tiny grey text for anything that matters.
- Failure is a first-class state: retries and dead-lettered deliveries are as visible as successes.
