# Backlog

Items not in the current phase scope; to be scheduled later.

---

## Phase 2 (optional, deferred)

- **Repo-pulled capabilities:** Support capabilities with `source` (e.g. GitHub/Hugging Face URL). Use `simple-git` to clone into a temp directory, then dynamic import JS default export `{ execute }`. Document: repos must expose JS (or “build before publish” for TS); only trusted repos; no sandbox in v1. Wire into `src/capabilities/load.ts` when `source` is set instead of throwing. Ref: [tip.md](tip.md) Phase 2 (Capability Puller), PRD 2.2 / 2.4.

---

## Backbone (future adapters)

- **RabbitMQ adapter** — Implement `BackboneAdapter` for `config.backbone.type === "rabbitmq"`; add to `createBackbone()` in `src/backbone/factory.ts`. Use amqplib or amqp-connection-manager.
- **Kafka adapter** — Implement `BackboneAdapter` for `config.backbone.type === "kafka"`; add to `createBackbone()` in `src/backbone/factory.ts`. Use kafkajs.

---

## Fault tolerance (remaining)

- Health checks, rogue detection, offline fallback, retries, DLQ, monitoring (beyond app-level circuit breaker). Ref: Phase 4 in verification.

---

## Optional polish

- **Inline-tool / auth** — Use auth registry in `src/capabilities/adapters/inline-tool.ts` for consistency with docs (optional).

---

## Phase 5

- Docker Compose, testing polish (per TIP).
