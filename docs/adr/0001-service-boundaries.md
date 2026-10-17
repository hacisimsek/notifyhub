# ADR-0001: Service Boundaries

## Status

Accepted

## Context

NotifyHub needs to demonstrate a microservice-based reminder and notification system without turning the early MVP into a distributed system exercise with too many moving parts.

## Decision

The initial backend will be split into these service boundaries:

- `auth-service`: users, credentials, JWT issuing, role ownership and login throttling.
- `reminder-service`: reminder commands, queries, scheduling metadata and reminder-triggered events.
- `notification-service`: notification logs, delivery attempts and channel adapters.
- `gateway-service`: external routing, CORS and authentication enforcement.
- `common`: shared contracts and small cross-service utilities only.

## Consequences

- Each domain can evolve independently while still supporting a working vertical slice.
- Shared code must stay small. Business logic should not move into `common`.
- Cross-service calls should be explicit through APIs or messages, not hidden inside shared libraries.

## Amendment (2026-10-17)

The original decision also listed rate limiting under `gateway-service`. General request rate limiting was not implemented. Brute-force protection lives in `auth-service` as per-email login throttling (5 failures per 15 minutes, Redis-backed). A Gateway-wide rate limit remains a possible future addition.
