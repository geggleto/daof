# DAOF — For AI agents

This file is the single entry point for AI agents working on this codebase. Read it first for project understanding, architecture, and where to find full technical detail.

## Purpose

DAOF (Declarative Agentic Orchestration Framework) runs autonomous AI organizations from a single YAML manifest. You define agents, capabilities (tools/skills), workflows (cron or event-triggered), backbone (queues), and fault tolerance in YAML; the runtime bootstraps and executes workflows. **Intended use is CLI-only** for end users: `daof validate`, `daof run`, `daof kill`, `daof build "<description>"`, `daof plan [description]`. Programmatic use (e.g. `loadYaml`, `validate`, `bootstrap`, `runWorkflow`) exists for integration or tooling but is not the supported end-user interface for the MVP.

## Repository layout

| Path | Description |
|------|--------------|
| `src/` | TypeScript source. For full types and signatures see [docs/API_REFERENCE.md](docs/API_REFERENCE.md). |
| `src/cli/` | CLI entry (`daof` commands) and PID/detach helpers. |
| `src/runtime/` | Bootstrap, run context (RunContext for capabilities), middleware pipeline (agent/capability), agent-metrics store, middleware registry. |
| `src/workflow/` | Triggers, executor, LangGraph runner, scheduler, cron-due. |
| `src/backbone/` | Redis adapter, semaphore, run registry, checkpoint/capability stores. |
| `src/capabilities/` | Loader, adapters (inline-tool), bundled capabilities, auth. |
| `src/agents/` | Agent type and bootstrap. |
| `src/providers/` | Provider registry and service layer (Cursor only for MVP); see [docs/providers.md](docs/providers.md). API key from env (e.g. CURSOR_API_KEY). |
| `src/schema/` | Zod schemas and config types (OrgConfig, etc.). |
| `src/fault/` | App-level circuit breaker. |
| `src/parser/`, `src/config/`, `src/types/` | YAML loading, env resolution, JsonValue/CapabilityInput/Output. |
| `src/tickets/` | MongoDB-backed ticket store for workflow run observability (one ticket per run; agents/capabilities append via RunContext.ticket). |
| `src/build/` | Build flow: Planner (PRD), review, Generator, merge into org, Verifier. Uses org-level planner/generator/builder/verifier agents when present; supports `--via-events` (build.requested / build.replies). |
| `docs/` | Human and agent documentation. |

**MongoDB is required** for running workflows: bootstrap connects to Mongo for the registry (skills/capabilities) and the ticket store. Configure `registry.mongo_uri` in the manifest or set `REGISTRY_MONGO_URI` / `MONGO_URI` (default `mongodb://localhost:27017`).

## Key entry points

- **CLI:** [src/cli/index.ts](src/cli/index.ts) — `daof validate <file>`, `daof run <file> [--workflow <name>] [-d] [--pid-file <path>]`, `daof kill <run_id> <file>`, `daof ticket <id>` (show workflow run ticket history), `daof plan [description] [--file <path>] [--provider <id>] [--no-edit] [--execute]` (interactive Planner-only: develop a PRD, optionally revise/save/execute), `daof build "<description>" [--file <path>] [--yolo] [--provider <id>] [--via-events]` (generate capabilities/workflows/agents and merge into org; use --via-events to trigger build via backbone events when org is running).
- **Programmatic:** [src/index.ts](src/index.ts) — `loadYaml`, `validate`, `bootstrap`, `connectBackbone`, `runWorkflow`, `createBackbone`, `createAppCircuitBreaker`; types: `OrgConfig`, `OrgRuntime`, `RunContext`, `BackboneAdapter`, `RunWorkflowOptions`, `CapabilityInput`, `CapabilityOutput`, `JsonValue`, `ParsedYaml`, `CapabilityInstance`. Flow: load YAML → validate → bootstrap → (optional) connectBackbone → runWorkflow or start scheduler. See [docs/workflow-engine.md](docs/workflow-engine.md) for workflow API and scheduler.

## Full technical reference

For the **full class and type map**, and **all exported function/interface signatures and return types**, see **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)**. Use it when you need exact parameter types, return types, or the shape of config/context types.

## Other docs

- [docs/workflow-engine.md](docs/workflow-engine.md) — Workflow engine: types, triggers, runWorkflow, templates, conditions, scheduler, traceability, kill.
- [docs/capabilities.md](docs/capabilities.md) — Capabilities: depends_on, invokeCapability, types, loading.
- [docs/build-flow.md](docs/build-flow.md) — Build flow: daof build architecture (Planner, review gate, Generator, merge, Verifier, retry); org-level agents and event mode.
- [docs/build-events.md](docs/build-events.md) — Build events: build.requested, build.replies, payloads, and build_on_request workflow.
- [docs/backbone.md](docs/backbone.md) — Backbone (queues): adapter interface, Redis, semaphore/run registry keyspaces.
- [docs/providers.md](docs/providers.md) — Provider service layer: LLMProviderService, getProviderService, Cursor implementation.
- [docs/authentication.md](docs/authentication.md) — Auth strategies for external capabilities.
- [docs/verification.md](docs/verification.md) — Requirements traceability and verification.
- [docs/registry.md](docs/registry.md) — Skills/capabilities registry (MongoDB), staleness, archiving, prune_registry, Curator agent.
- [docs/tickets.md](docs/tickets.md) — Ticketing: one ticket per workflow run, RunContext.ticket, `daof ticket <id>`, Mongo required.
- [docs/prd.md](docs/prd.md), [docs/tip.md](docs/tip.md), [docs/backlog.md](docs/backlog.md) — Product and backlog context.
