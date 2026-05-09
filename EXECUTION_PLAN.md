# NotifyHub Execution Plan

Bu plan, `Haci Simsek - 2026 Performance Project.docx` dosyasındaki kapsam baz alınarak hazırlandı. Kaynak dokümandaki tarih aralığı Mayıs-Aralık 2025 olduğu için güncel başlangıç tarihi 1 Mayıs 2026 olarak yeniden planlandı.

## Hedef

NotifyHub; kullanıcıların hatırlatıcı oluşturduğu, zamanlanan olayların işlenip email, SMS/mock ve push/mock kanallarına yönlendirildiği, teslimat durumunun dashboard üzerinden izlendiği mikroservis tabanlı bir bildirim sistemi olacak.

Ana çıktı iki seviyede yönetilecek:

1. **MVP demo:** Auth, reminder CRUD, temel notification flow, dashboard, Docker Compose ve CI.
2. **Full delivery:** Kafka + RabbitMQ ayrımı, DLQ/retry/idempotency, Kubernetes, Prometheus/Grafana, load test, runbook ve final demo.

## Scope Guardrails

- İlk hedef çalışan vertical slice: kullanıcı giriş yapar, reminder oluşturur, tetiklenen reminder notification log üretir, dashboard bunu gösterir.
- Email ilk aşamada SMTP/mock ile başlar; gerçek provider entegrasyonu kapsamı bozarsa adapter arayüzü bırakılıp mock kalabilir.
- SMS ve push MVP'de mock adapter olur. Gerçek Twilio/push entegrasyonu production-ready fazında opsiyonel kalır.
- CQRS karmaşıklığı minimum tutulur: command/read ayrımı servis sınırlarında ve query modellerinde uygulanır, erken aşamada ayrı veri deposu açılmaz.
- Kubernetes Minikube hedeflenir; cloud production deploy bu projenin zorunlu kapsamı değildir.

## Target Timeline

Agresif ama uygulanabilir plan:

| Faz | Tarih | Süre | Çıktı |
| --- | --- | ---: | --- |
| 0. Planning & repo foundation | 1 Mayıs - 3 Mayıs 2026 | 3 gün | Repo yapısı, README, ADR, Git stratejisi |
| 1. Backend foundation | 4 Mayıs - 8 Mayıs 2026 | 1 hafta | Java multi-module yapı, ortak config, CI başlangıcı |
| 2. Core MVP services | 11 Mayıs - 22 Mayıs 2026 | 2 hafta | Auth, Reminder, Notification temel REST akışları |
| 3. Messaging & delivery reliability | 25 Mayıs - 5 Haziran 2026 | 2 hafta | Kafka event flow, RabbitMQ queues, retry/DLQ, idempotency |
| 4. Dashboard MVP | 8 Haziran - 19 Haziran 2026 | 2 hafta | React dashboard, login, reminder CRUD, delivery status |
| 5. Containerization & Kubernetes | 22 Haziran - 3 Temmuz 2026 | 2 hafta | Docker Compose, Minikube manifests, probes |
| 6. Observability | 6 Temmuz - 17 Temmuz 2026 | 2 hafta | Actuator/Micrometer, Prometheus, Grafana dashboards |
| 7. Testing & CI/CD hardening | 20 Temmuz - 31 Temmuz 2026 | 2 hafta | Integration tests, smoke tests, GitHub Actions pipeline |
| 8. Docs, polish & final handover | 3 Ağustos - 14 Ağustos 2026 | 2 hafta | Runbook, architecture docs, final demo script |

MVP demo hedefi: **19 Haziran 2026**. Full delivery hedefi: **14 Ağustos 2026**.

## Proposed Repository Structure

```text
notifyhub/
  backend/
    pom.xml
    common/
    auth-service/
    reminder-service/
    notification-service/
    gateway-service/
  web/
    dashboard/
  deploy/
    docker/
    k8s/
  observability/
    prometheus/
    grafana/
  docs/
    adr/
    api/
    runbook/
  scripts/
  .github/
    workflows/
```

## Architecture Plan

- **Auth Service:** user registration, login, JWT issuing/validation support, role model.
- **Reminder Service:** reminder CRUD, owner checks, one-time and cron-like scheduling metadata, due reminder detection.
- **Notification Service:** consumes reminder events, writes notification logs, dispatches to channel adapters.
- **Gateway Service:** external routing, CORS, rate limiting, auth propagation.
- **PostgreSQL:** users, roles, reminders, notification logs, delivery attempts, outbox/idempotency tables.
- **Redis:** cache, rate-limit counters, optional token/session helpers.
- **Kafka:** canonical reminder-triggered event stream.
- **RabbitMQ:** channel-specific delivery work queues, retry and DLQ routing.
- **React Dashboard:** auth screens, reminder management, notification history, basic delivery charts.

## Execution Backlog

### Phase 0: Planning & Repo Foundation

- Create project README with scope, local run instructions and module overview.
- Add `.editorconfig`, expanded `.gitignore`, license/metadata if needed.
- Add ADRs:
  - ADR-001 microservice boundaries.
  - ADR-002 Kafka vs RabbitMQ responsibilities.
  - ADR-003 MVP channel strategy.
- Define branch and commit rules.

### Phase 1: Backend Foundation

- Create Maven parent under `backend/`.
- Add shared `common` module for DTOs, error response shape, tracing constants and test utilities.
- Scaffold Spring Boot services:
  - `auth-service`
  - `reminder-service`
  - `notification-service`
  - `gateway-service`
- Add health endpoints and basic service tests.
- Add initial GitHub Actions build/test workflow.

### Phase 2: Core MVP Services

- Auth:
  - Registration.
  - Login.
  - JWT generation.
  - Password hashing.
  - Role model: `USER`, `ADMIN`.
- Reminder:
  - Create, update, delete, list.
  - Owner-based access.
  - One-time reminders first, cron metadata second.
- Notification:
  - Notification log model.
  - Email/mock adapter.
  - Delivery status lifecycle: `PENDING`, `SENT`, `FAILED`, `RETRYING`.
- API documentation:
  - OpenAPI per service.
  - Example requests in docs.

### Phase 3: Messaging & Reliability

- Kafka:
  - `reminder.triggered` topic.
  - producer in Reminder Service.
  - consumer in Notification Service.
- RabbitMQ:
  - exchange per notification domain.
  - queues per channel: email, sms, push.
  - retry queue and DLQ.
- Reliability:
  - idempotency key per reminder occurrence.
  - delivery attempt table.
  - safe retry policy.
  - failure reason tracking.
- Add short Kafka vs RabbitMQ comparison doc.

### Phase 4: Dashboard MVP

- Create React + Vite dashboard under `web/dashboard`.
- Add Tailwind and app shell.
- Implement:
  - login/register screens.
  - authenticated routes.
  - reminder list/create/edit/delete.
  - notification history.
  - delivery status filters.
  - simple Recharts-based stats.
- Add basic frontend tests where useful.

### Phase 5: Containerization & Kubernetes

- Dockerfiles for backend services and dashboard.
- Docker Compose for local development:
  - PostgreSQL
  - Redis
  - Kafka
  - RabbitMQ
  - services
  - dashboard
- Minikube manifests:
  - Deployments.
  - Services.
  - ConfigMaps.
  - Secrets placeholders.
  - liveness/readiness probes.
- Add local smoke scripts.

### Phase 6: Observability

- Add Spring Boot Actuator and Micrometer metrics.
- Prometheus scrape config.
- Grafana dashboards:
  - service health.
  - request latency.
  - notification throughput.
  - delivery failures.
  - queue depth where available.
- Alerting rules:
  - service down.
  - high error rate.
  - DLQ growth.

### Phase 7: Testing & CI/CD Hardening

- Unit tests for service logic.
- Integration tests for repositories and key endpoints.
- Messaging integration tests for Kafka/RabbitMQ flow.
- Smoke tests for Docker Compose.
- GitHub Actions:
  - backend build/test.
  - frontend build/test.
  - Docker image build.
  - optional deploy dry-run for Kubernetes manifests.

### Phase 8: Docs & Final Handover

- Architecture diagram.
- Local development guide.
- API usage guide.
- Runbook:
  - startup/shutdown.
  - common failures.
  - DLQ handling.
  - dashboard demo flow.
- Final demo script and screenshots.

## Commit Strategy

Commits will be small and milestone-based. A commit should represent one coherent step and pass the relevant checks.

Suggested commit sequence:

1. `docs(plan): add notifyhub execution plan`
2. `chore(repo): add project metadata and docs skeleton`
3. `chore(backend): scaffold spring boot services`
4. `ci: add backend build workflow`
5. `feat(auth): add registration and login`
6. `feat(reminder): add reminder crud api`
7. `feat(notification): add notification log and mock email adapter`
8. `feat(messaging): publish reminder triggered events`
9. `feat(messaging): add rabbitmq delivery queues and dlq`
10. `feat(web): add dashboard shell and auth flow`
11. `feat(web): add reminder management`
12. `feat(web): add notification history and stats`
13. `chore(docker): add local compose environment`
14. `chore(k8s): add minikube manifests`
15. `feat(observability): add prometheus and grafana setup`
16. `test: add integration and smoke coverage`
17. `docs: add runbook and final demo guide`

Before each commit:

- Run targeted tests for touched modules.
- Check `git status --short`.
- Stage only intentional files.
- Use conventional commit style.
- Avoid committing broken intermediate states.

## Branch Strategy

- `main`: stable branch.
- `feature/notifyhub-foundation`: initial scaffold branch.
- Later feature branches:
  - `feature/auth-service`
  - `feature/reminder-service`
  - `feature/messaging-flow`
  - `feature/dashboard-mvp`
  - `feature/k8s-observability`

If the user wants a single continuous branch, all work can continue on `feature/notifyhub-foundation` with frequent commits.

## Definition of Done

A phase is done when:

- The code builds locally.
- Relevant automated tests pass.
- Local run instructions are updated.
- The next developer can start the services using documented commands.
- The Git commit is clean and scoped.

The project is done when:

- MVP user flow works end-to-end.
- Kafka and RabbitMQ responsibilities are demonstrated.
- Docker Compose local environment works.
- Minikube manifests deploy.
- Prometheus/Grafana show service and notification metrics.
- CI runs build/test checks.
- Runbook and final demo guide exist.

## Current Remaining Steps

The implementation has moved past the foundation and MVP service phases. The remaining work is final evidence capture:

1. Run `./scripts/final-verify.sh` locally before final review.
2. Run `TEARDOWN=true ./scripts/local-stack-e2e.sh` with Docker Desktop running.
3. Run `./scripts/k8s-local-verify.sh` with Minikube running.
4. Capture final demo evidence from the dashboard, notification history, Prometheus and Grafana.
5. Close any issues found during those environment-dependent checks.

## Executive Plan Update (9 Mayıs 2026)

Bu bölüm kalan işleri “release readiness” bakışına göre önceliklendirir.

### Overall Status

- Ürün kapsamı (backend servisleri, dashboard, deploy ve observability varlıkları) tamamlanmış durumda.
- Kalan işler ağırlıklı olarak **ortam-bağımlı final doğrulama** ve **kanıt toplama** adımları.
- Kod geliştirme backlog’u yerine “go-live doğrulama backlog’u” aşamasındayız.

### Priority 1 — Release Gate Verification

1. `./scripts/final-verify.sh` çalıştır, artefact olarak tam terminal çıktısını sakla.
2. Docker ortamında `TEARDOWN=true ./scripts/local-stack-e2e.sh` çalıştır.
3. Minikube ortamında `./scripts/k8s-local-verify.sh` çalıştır.

Çıkış kriteri: Üç komut da hata kodu vermeden tamamlanmalı.

### Priority 2 — Executive Evidence Pack

1. Dashboard akış ekranları: login, reminder CRUD, notification history.
2. Prometheus hedef/metric görüntüsü.
3. Grafana panel görüntüleri (latency, throughput, error/failure, queue/dlq sinyali).
4. Bu çıktıları tek klasörde tarihli paketle (ör. `docs/demo/evidence-2026-05-09/`).

Çıkış kriteri: Demo sırasında uçtan uca iş akışı ve metrikler tek dosya seti ile gösterilebilir olmalı.

### Priority 3 — Remaining Risk Burn-down

1. Environment-dependent script’lerde fail olursa issue aç, etki alanını etiketle (backend/web/deploy/obs).
2. Kritik fail (P0/P1) için hotfix branch aç (`fix/<kisa-ad>`), non-critical için release sonrası backlog’a taşı.
3. Düzeltmeler sonrası Priority 1 adımlarını yeniden çalıştır.

Çıkış kriteri: Açık kritik issue kalmaması.

### Ownership and Sequence (Suggested)

1. **Backend/Platform:** final-verify + local stack e2e
2. **DevOps/K8s:** minikube verify
3. **Product/Demo owner:** evidence pack toplama ve demo script son kontrol

### Decision Point

- Priority 1 ve Priority 3 geçerse: release/demo onayı verilir.
- Geçmezse: yalnızca blocking issue’lara odaklı kısa bir stabilization sprint açılır.

## Auth Password Change Execution Plan

Scope: add an authenticated password change flow without introducing server-side sessions.

1. Add `POST /api/auth/password` to Auth Service with `currentPassword` and `newPassword`.
2. Require bearer authentication and verify the current password before changing the stored hash.
3. Return a bearer auth response after a successful change so the dashboard can refresh the stored token.
4. Expose the same route through Gateway Service while preserving the bearer token for Auth Service validation.
5. Add dashboard API support and a top-bar Password drawer with current/new/confirm password fields.
6. Update OpenAPI and README files so local usage and API examples include the new route.
7. Verify with backend integration tests, dashboard tests and production dashboard build.
