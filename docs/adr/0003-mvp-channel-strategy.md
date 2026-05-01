# ADR-0003: MVP Notification Channel Strategy

## Status

Accepted

## Context

The project scope includes email, SMS and push notifications. Real provider integrations can slow down the MVP because they require credentials, account setup and provider-specific failure handling.

## Decision

The MVP will implement channel adapters with these priorities:

1. Email adapter with SMTP-ready structure and mock delivery mode.
2. SMS adapter as mock delivery.
3. Push adapter as mock delivery.

The adapters will expose the same internal interface so real providers can be added later without changing notification orchestration.

## Consequences

- The end-to-end flow can be demonstrated early.
- Delivery status and retry behavior can be tested without provider accounts.
- Real Twilio or push-provider integration remains optional until the system is otherwise stable.
