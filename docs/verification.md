# PRD Requirements Traceability

This document maps [PRD](prd.md) requirements to implementation status, verification (tests or manual steps), and code location. Update it when completing a phase or adding tests.

---

## Functional requirements

| PRD ref | Requirement | Status | Verified by | Implementation |
|---------|-------------|--------|-------------|----------------|
| **2.1** | YAML manifest structure; validation via Zod at runtime; Manifest v1 spec (version, org, agents, capabilities, workflows, backbone, fault_tolerance) | Done | `tests/validate-readme.example.test.ts` (load + validate, top-level keys, first workflow step) | `src/schema/index.ts`, `src/parser/index.ts`, [tip.md §2.1](tip.md) |
| **2.2** Parser/Validator | Load YAML, validate schema | Done | Same as 2.1; CLI `daof validate org.yaml` | `src/parser/index.ts`, `src/cli/index.ts` |
| **2.2** Org Bootstrap | Init agents and capabilities (no queues yet) | Done | `tests/validate-readme.example.test.ts` (bootstrap + ceo.invoke('check_budget')); `daof run org.example.yaml` | `src/runtime/bootstrap.ts`, `src/agents/`, `src/capabilities/` |
| **2.2** Pull repos | Fetch capabilities from GitHub/Hugging Face (git clone/fetch) | Not started | — | — |
| **2.2** Workflow running | Trigger on schedules/events; execute steps in graph; chain outputs as inputs | Done | `tests/workflow-context.test.ts`, `tests/workflow-trigger.test.ts`, `tests/workflow-executor.test.ts`, `tests/workflow-integration.test.ts`; `daof run org.example.yaml --workflow hourly_metrics` | `src/workflow/types.ts`, `src/workflow/context.ts`, `src/workflow/trigger.ts`, `src/workflow/executor.ts`; CLI `--workflow` in `src/cli/index.ts` |
| **2.2** Backbone | Connect queues (Redis/RabbitMQ/Kafka); agents emit/receive via queues | Partial | Redis: `tests/backbone.test.ts`; `connectBackbone(runtime)` in run path; agents receive `RunContext` with `backbone` in `invoke`/`execute`. Run with Redis: `REDIS_AVAILABLE=1 npm test`. | `src/backbone/`, `src/runtime/bootstrap.ts`, `src/runtime/run-context.ts`, `src/cli/index.ts`, `src/workflow/executor.ts`, `src/agents/agent.ts`. RabbitMQ/Kafka in backlog. |
| **2.2** Persistence | Auto-store workflow state; capabilities query/store (Redis/SQL) | Partial | Workflow checkpoints: `tests/workflow-executor.test.ts` (checkpoint save after each step); `connectBackbone` sets `runtime.checkpointStore` for Redis. Keyspace `daof:checkpoint:*`; capability data uses `daof:capability:*`. | `src/backbone/checkpoint-store.ts`, `src/workflow/executor.ts`, `src/runtime/bootstrap.ts`. |
| **2.3** | Fault tolerance (health checks, rogue detection, offline fallback, retries, circuit breakers, DLQ, monitoring) | Partial | App-level circuit breaker: after 5 failures process exits gracefully. **Verified by:** `tests/workflow-executor.test.ts` (circuit opens after threshold); CLI exits 1 on circuit open. | `src/fault/circuit-breaker.ts`, `src/workflow/executor.ts` (RunWorkflowOptions.circuitBreaker), `src/cli/index.ts`. |
| **2.4** Repo pulling | GitHub/Hugging Face for capabilities; dynamic import | Not started | — | — |
| **2.4** Capability types | Tool (API wrappers), Skill (prompt), Persistent (storage hooks) | Partial | Inline tool adapter (HTTP or stub) | `src/capabilities/adapters/inline-tool.ts`; Skill/Persistent deferred |
| **2.4** External services | Configurable in YAML (e.g. endpoints, api_key) | Partial | Env resolution for config; inline tool uses config.endpoint | `src/config/resolve-env.ts`, inline-tool |
| Capabilities invoke other capabilities | depends_on in manifest; RunContext.invokeCapability; scoped invoker per capability | Done | Runtime: invokeCapability enforces depends_on and builds nested RunContext; executor uses createRunContext(runtime, step.action, agentLlm). Schema: depends_on in CapabilityDefinitionSchema. | `src/schema/index.ts`, `src/runtime/run-context.ts`, `src/workflow/executor.ts`. See [docs/capabilities.md](capabilities.md), [docs/workflow-engine.md](workflow-engine.md). |
| Auth strategy/adapter (Option A per-capability config) | Pluggable auth strategies (bearer, api_key, basic); registry; capabilities use config.auth | Done | Unit tests: strategies and registry (`tests/auth-strategies.test.ts` or equivalent). Legacy `config.api_key` → bearer. | `src/capabilities/auth/` (types, registry, strategies); bundled HTTP capabilities use `getAuthHeadersFromCapabilityConfig`. [docs/authentication.md](authentication.md). |

---

## Non-functional requirements

| PRD ref | Requirement | Status | Verified by | Implementation |
|---------|-------------|--------|-------------|----------------|
| **3** Usability | CLI: `daof run org.yaml`, `daof validate org.yaml` | Done | Manual run; tests use parser + bootstrap | `src/cli/index.ts` (commander) |
| **3** Tech stack | TypeScript/Node, yaml, Zod, (queues/graphs/cron/simple-git per TIP) | Partial | Build + test | `package.json`; queues/graphs/simple-git not yet used |
| **3** Performance, Scalability, Security, Reliability | Sub-second latency; horizontal scale; scoped capabilities; 99% uptime | Not started | — | Phase 3+ |

---

## Manifest v1 spec alignment

| Source | Status | Verified by |
|--------|--------|-------------|
| [tip.md §2.1](tip.md) Manifest v1 spec (root keys, nesting, constraints) | Done | Zod schema validates; canonical `org.example.yaml` passes; same shape as readme org.yaml |

---

## Phase 3 tasks (next step)

Scope for Phase 3: Workflow Engine and Backbone. When implemented, update the table above and set Status to Done for the relevant 2.2 rows.

| Task | PRD / TIP | Acceptance (verifiable by) |
|------|-----------|----------------------------|
| Workflow engine | 2.2 Workflow running; TIP Phase 3 | **Done.** Build graph from workflow steps (sequential + parallel); execute steps in order; pass step output as input to next; support trigger parsing (cron/event). **Verified by:** `tests/workflow-*.test.ts` (context, trigger, executor unit + integration); `daof run org.example.yaml --workflow hourly_metrics` and `daily_content_cycle`. **Implementation:** `src/workflow/` (types, context, trigger, executor); `src/cli/index.ts` (`--workflow`). |
| Backbone client | 2.2 Backbone; TIP Phase 3 | **Done (Redis).** Adapter pattern: `BackboneAdapter` interface; `createBackbone(config)` returns Redis adapter. Connect, publish, subscribe. **Verified by:** `tests/backbone.test.ts` (factory + Redis pub/sub; set `REDIS_AVAILABLE=1` for integration). **Implementation:** `src/backbone/types.ts`, `src/backbone/redis-adapter.ts`, `src/backbone/factory.ts`; `OrgRuntime.backbone`, `connectBackbone()`. |
| Triggers | 2.2 Workflow running | **Done.** Parse `cron(...)` and `event(...)` in `parseTrigger`. **Verified by:** `tests/workflow-trigger.test.ts`. Manual run only (no long-lived scheduler in this phase). |
| `daof run` runs workflow | 2.2; Usability | **Done.** `daof run org.yaml [--workflow <name>]` runs one workflow after bootstrap. **Verified by:** `tests/workflow-integration.test.ts`; manual `daof run org.example.yaml --workflow hourly_metrics`. |
| Checkpoints / persistence | 2.2 Persistence | **Done.** Persist workflow state at step boundaries. **Verified by:** `tests/workflow-executor.test.ts` (saves checkpoint after each step when checkpointStore set). **Implementation:** `src/backbone/checkpoint-store.ts` (CheckpointStore, Redis with keyspace `daof:checkpoint:*`); `connectBackbone` sets `runtime.checkpointStore` for Redis; `runWorkflow` saves after each step. Capability persistence uses separate keyspace `daof:capability:*`. |
| App-level circuit breaker | 2.3 Fault tolerance | **Done.** After 5 failures (configurable), circuit opens and process quits gracefully (exit 1). **Verified by:** `tests/workflow-executor.test.ts` (circuit opens after threshold); CLI logs "Circuit breaker open..." and exits 1. **Implementation:** `src/fault/circuit-breaker.ts` (createAppCircuitBreaker), `src/workflow/executor.ts` (RunWorkflowOptions.circuitBreaker), `src/cli/index.ts`. Uses p-circuit-breaker. |

After Phase 3: Phase 4 (Fault Tolerance). App-level circuit breaker done (5 failures then graceful exit). Remaining Phase 4 (retries, per-agent breakers, DLQ, health checks, rogue detection) and Phase 5 (Testing & Polish, Docker Compose) are out of scope for this v1 plan.

---

## Backlog (future backbones)

| Item | Notes |
|------|-------|
| **RabbitMQ backbone adapter** | Implement `BackboneAdapter` for `config.backbone.type === "rabbitmq"`; add to `createBackbone()` in `src/backbone/factory.ts`. Use amqplib or amqp-connection-manager. |
| **Kafka backbone adapter** | Implement `BackboneAdapter` for `config.backbone.type === "kafka"`; add to `createBackbone()` in `src/backbone/factory.ts`. Use kafkajs. |

---

## How to update

- When a requirement is implemented: set **Status** to Done, fill **Verified by** (test path or manual step), set **Implementation** (file or area).
- When adding a test that proves a requirement: add or update the row for that requirement.
- When starting a phase: add or update rows for the requirements that phase will address; set Status to In progress when appropriate.
