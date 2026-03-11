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

## SOLID / maintainability (deferred)

Remaining items from the SOLID violations scan; to be addressed later.

- **Schema split (ISP)** — Split `src/schema/index.ts` into smaller modules (e.g. `schema/capability.ts`, `schema/workflow.ts`, `schema/org.ts`) with focused types and re-export from index for compatibility.
- **CapabilityDefinition segregation (ISP)** — Consider union or segregated types (e.g. `ToolCapabilityDefinition`, `SkillCapabilityDefinition`) so consumers depend on a smaller shape instead of one fat type.
- **Parser / env injection (DIP)** — Inject file reader and/or YAML parser in `src/parser/index.ts` for testability; inject env getter in `src/config/resolve-env.ts` (e.g. `(key: string) => string | undefined`) instead of using `process.env` directly.
- **Trigger / scheduler OCP** — Make trigger handling open/closed: e.g. map `trigger type → handler` so new trigger types (e.g. webhook) register a handler without editing `src/workflow/scheduler.ts` or `parseTrigger`.
- **Redis queue-type strategies (OCP)** — In `src/backbone/redis-adapter.ts`, delegate publish/subscribe to queue-type-specific strategies (pubsub vs fifo) so new queue types add a strategy without new branches in the adapter.
- **Provider resolver injection (DIP)** — Optional: pass a “provider service resolver” into text_generator (e.g. via RunContext) and/or have executor receive API key from runtime instead of calling `getProviderApiKey` from the registry, so tests or alternate provider sources can inject without the global registry.
- **x_poster abstraction (DIP)** — Introduce a small “social poster” interface; implement with Twitter SDK in one module so another implementation (e.g. Mastodon, stub) can be swapped.
- **Auth registry (DIP)** — Have auth strategies self-register or build the registry from config so adding a new strategy doesn’t require editing `src/capabilities/auth/registry.ts`.

---

## Phase 5

- Docker Compose, testing polish (per TIP).
