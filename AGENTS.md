# DAOF — For AI agents

This file is the single entry point for AI agents working on this codebase. Read it first for project understanding, architecture, and where to find full technical detail.

## Purpose

DAOF (Declarative Agentic Orchestration Framework) runs autonomous AI organizations from a single YAML manifest. You define agents, capabilities (tools/skills), workflows (cron or event-triggered), backbone (queues), and fault tolerance in YAML; the runtime bootstraps and executes workflows. **Intended use is CLI-only** for end users: `daof validate`, `daof run`, `daof kill`. Programmatic use (e.g. `loadYaml`, `validate`, `bootstrap`, `runWorkflow`) exists for integration or tooling but is not the supported end-user interface for the MVP.

## Repository layout

| Path | Description |
|------|--------------|
| `src/` | TypeScript source. For full types and signatures see [docs/API_REFERENCE.md](docs/API_REFERENCE.md). |
| `src/cli/` | CLI entry (`daof` commands) and PID/detach helpers. |
| `src/runtime/` | Bootstrap, run context (RunContext for capabilities). |
| `src/workflow/` | Triggers, executor, LangGraph runner, scheduler, cron-due. |
| `src/backbone/` | Redis adapter, semaphore, run registry, checkpoint/capability stores. |
| `src/capabilities/` | Loader, adapters (inline-tool), bundled capabilities, auth. |
| `src/agents/` | Agent type and bootstrap. |
| `src/providers/` | Provider registry (Cursor only for MVP); API key from env (e.g. CURSOR_API_KEY). |
| `src/schema/` | Zod schemas and config types (OrgConfig, etc.). |
| `src/fault/` | App-level circuit breaker. |
| `src/parser/`, `src/config/`, `src/types/` | YAML loading, env resolution, JsonValue/CapabilityInput/Output. |
| `docs/` | Human and agent documentation. |

## Key entry points

- **CLI:** [src/cli/index.ts](src/cli/index.ts) — `daof validate <file>`, `daof run <file> [--workflow <name>] [-d] [--pid-file <path>]`, `daof kill <run_id> <file>`.
- **Programmatic:** [src/index.ts](src/index.ts) — `loadYaml`, `validate`, `bootstrap`, `connectBackbone`, `runWorkflow`, `createBackbone`, `createAppCircuitBreaker`; types: `OrgConfig`, `OrgRuntime`, `RunContext`, `BackboneAdapter`, `RunWorkflowOptions`, `CapabilityInput`, `CapabilityOutput`, `JsonValue`, `ParsedYaml`, `CapabilityInstance`. Flow: load YAML → validate → bootstrap → (optional) connectBackbone → runWorkflow or start scheduler. See [docs/workflow-engine.md](docs/workflow-engine.md) for workflow API and scheduler.

## Full technical reference

For the **full class and type map**, and **all exported function/interface signatures and return types**, see **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)**. Use it when you need exact parameter types, return types, or the shape of config/context types.

## Other docs

- [docs/workflow-engine.md](docs/workflow-engine.md) — Workflow engine: types, triggers, runWorkflow, templates, conditions, scheduler, traceability, kill.
- [docs/capabilities.md](docs/capabilities.md) — Capabilities: depends_on, invokeCapability, types, loading.
- [docs/backbone.md](docs/backbone.md) — Backbone (queues): adapter interface, Redis, semaphore/run registry keyspaces.
- [docs/authentication.md](docs/authentication.md) — Auth strategies for external capabilities.
- [docs/verification.md](docs/verification.md) — Requirements traceability and verification.
- [docs/prd.md](docs/prd.md), [docs/tip.md](docs/tip.md), [docs/backlog.md](docs/backlog.md) — Product and backlog context.
