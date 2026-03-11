# DAOF — Implementation status

This file summarizes what is done and what is not. For full traceability and backlog detail see `docs/verification.md` and `docs/backlog.md`.

---

## Done

- Manifest & schema (Zod, validate, CLI `daof validate` / `daof run`)
- Org bootstrap, capability loading (bundled + inline-tool + skill)
- Workflow engine (context, trigger parsing, executor, sequential/parallel, step I/O)
- **LangGraph workflow engine** — Workflows run as StateGraph with checkpointer (thread_id); see `src/workflow/langgraph-runner.ts`, `graph-builder.ts`, `langgraph-state.ts`.
- Backbone Redis (adapter, factory, runtime, checkpoint store)
- Workflow checkpoints at step boundaries (LangGraph + final context to DAOF store when set)
- App-level circuit breaker (5 failures, graceful exit)
- depends_on + RunContext.invokeCapability
- Auth strategy/adapter (Option A: bearer, api_key, basic; registry; bundled HTTP + legacy api_key)
- Tool capabilities (bundled set + inline-tool for HTTP/stub)
- **Skill** — Skill capability type (prompt templates, optional LLM at config.endpoint). Loader branches on `type: "skill"`; see `src/capabilities/bundled/skill_runner.ts`. Skills support depends_on + invokeCapability.
- **Persistence** — Per-capability persistence: when `persistence` is set on a capability and runtime has a capability store, RunContext receives a scoped store (keyspace `daof:capability:{capabilityId}:*`). See `createScopedCapabilityStore` in `src/backbone/capability-store.ts` and `src/runtime/run-context.ts`.
- **Heartbeat/scheduler** — Cron workflows via heartbeat at configurable interval; YAML `scheduler.heartbeat_interval_seconds`, `max_concurrent_workflows`; Redis or in-memory semaphore; see `src/workflow/scheduler.ts`, `src/workflow/cron-due.ts`.
- **Run registry and kill** — Active runs registered in Redis; `daof kill <run_id> <file>` sets cancel flag; runner checks between steps; see `src/backbone/run-registry.ts`, CLI kill command.
- **Detach and PID file** — `daof run -d` runs org in background with PID file; `--pid-file` option; see `src/cli/pidfile.ts`.
- **Traceability** — event_id (per heartbeat) and run_id (per run) in context/checkpoints and logs for audit.

---

## To do (not done)

See [docs/backlog.md](docs/backlog.md) for future work.

---

## References

Details: `docs/verification.md`, `docs/backlog.md`, `docs/prd.md`, `docs/tip.md`.
