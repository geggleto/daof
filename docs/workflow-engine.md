# Workflow engine

The workflow engine runs workflows from the org manifest: it executes steps (sequential or parallel), passes step outputs into a shared context, and resolves templates and conditions. The engine is implemented with **LangGraph**: each workflow is built as a `StateGraph`, with one node per step and a checkpointer for thread-scoped persistence and resume. This page describes the engine’s **inputs and outputs at a code/JSON level**. Implementation: `src/workflow/`.

The primary way to run workflows is via the CLI: `daof run <file> [--workflow <name>]`.

### Daemon mode (in-memory org, sync on shutdown)

When you run `daof run <file>` **without** `--workflow`, the process runs as the long-running scheduler (heartbeat + cron + event subscriber). In this mode the org is kept **in memory**: the manifest is loaded once at startup, and any changes applied during the run (e.g. by the `merge_and_write` capability when a build is triggered via `build.requested`) update the in-memory config only, not the file. On shutdown (SIGINT or SIGTERM), the runtime writes the in-memory config back to `<file>` so that merges and upgrades are persisted. One-shot runs (`daof run <file> --workflow <name>`) and standalone `daof build` (without `--via-events`) continue to read and write the org file directly; only the scheduler path uses in-memory config with sync on exit.

---

## 1. Core types (code/JSON level)

### WorkflowContext

Accumulated outputs from steps so far, keyed by **agent id** (the agent that produced the output).

```ts
type WorkflowContext = Record<string, CapabilityOutput>;
```

- **Key:** agent id (e.g. `"cmo"`, `"data_analyst"`).
- **Value:** `CapabilityOutput` — the result of that agent’s last step (see [CapabilityInput / CapabilityOutput](#capabilityinput--capabilityoutput)).

Example (after two steps, `ceo` then `cmo`):

```json
{
  "ceo": { "ok": true, "capabilityId": "check_budget", "input": {} },
  "cmo": { "recommended_variants": ["a", "b"], "strategy_id": "s1" }
}
```

For parallel steps, each branch writes under its agent id; if two steps use the same agent, last write wins.

### WorkflowRunResult

Return type of `runWorkflow`.

```ts
interface WorkflowRunResult {
  success: boolean;
  context: WorkflowContext;
  error?: Error;   // present when success === false
}
```

- **success:** `true` if all steps completed without throwing.
- **context:** final workflow context (all step outputs).
- **error:** set when a step threw; workflow stops and returns this result.

### CapabilityInput / CapabilityOutput

Defined in `src/types/json.ts`. Used for step params and for values in `WorkflowContext`.

- **CapabilityInput:** `Record<string, JsonValue>` — input to a capability (e.g. step `params` after resolution).
- **CapabilityOutput:** `Record<string, JsonValue>` — output from a capability (stored in context under the step’s agent id).

**JsonValue:** `string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }` (no `unknown`/`any`).

---

## 2. Trigger types (parsed from manifest)

Workflows have `trigger: string` in the manifest (e.g. `cron(0 9 * * *)` or `event(strategy_ready)`). The engine **parses** these. When running the org (scheduler mode), **cron**-triggered workflows are run on the heartbeat when due; **event**-triggered workflows are run when the scheduler subscribes to the backbone events queue and receives a message whose `event_type` matches the workflow’s `event(eventName)`. The event message is expected to be JSON with `event_type` and optional `payload`; the workflow is run with `initialInput = { ...payload, __event_id }`, so step params can reference `{{ __initial.<key> }}` (e.g. `{{ __initial.url }}`, `{{ __initial.post_id }}`).

```ts
type ParsedTrigger = CronTrigger | EventTrigger;

interface CronTrigger {
  type: "cron";
  expression: string;   // e.g. "0 9 * * *"
}

interface EventTrigger {
  type: "event";
  eventName: string;    // e.g. "strategy_ready"
}
```

- **Parse:** `parseTrigger(trigger: string): ParsedTrigger` in `src/workflow/trigger.ts`.
- **Formats:** `cron(<expression>)`, `event(<eventName>)`. Unsupported strings throw.

---

## 3. API

### runWorkflow

```ts
function runWorkflow(
  runtime: OrgRuntime,
  workflowId: string,
  initialInput?: CapabilityInput
): Promise<WorkflowRunResult>;
```

- **runtime:** Bootstrapped org (config, agents, capabilities). Each agent in the manifest has **provider** and **model** (e.g. `provider: cursor`, `model: auto`); providers are defined in code (Cursor only for MVP), and the provider’s API key is read from the environment (e.g. `CURSOR_API_KEY`). When backbone is connected, step execution receives a **RunContext** (e.g. `{ backbone: runtime.backbone, agentLlm }`) so agents/capabilities can publish in realtime and use the agent’s LLM config.
- **workflowId:** Key in `runtime.config.workflows`. Throws if missing.
- **initialInput (optional):** Merged into initial context as `__initial` when non-empty. When running under the scheduler, `__event_id` (and optionally `__run_id`) are passed for traceability.
- **options.runRegistry (optional):** When set (scheduler mode), the run is registered for cancellation; the runner checks a cancel flag between steps and unregisters on exit.
- **Returns:** `{ success, context, error? }`. On step throw: `success === false`, `error` set, `context` is the context up to the failing step.

**LangGraph:** `runWorkflow` delegates to a LangGraph-based runner. The workflow is built as a `StateGraph` (one node per step); state holds the workflow context; each node calls the existing step execution logic. The graph is compiled with a checkpointer (e.g. `MemorySaver`); each run uses a **thread_id** (`workflowId:runId`) so state is persisted at every super-step and execution can be resumed or inspected. When `runtime.checkpointStore` is set, the **final** context is also written to the DAOF checkpoint store after a successful run (keyspace `daof:checkpoint:*`). See [src/workflow/langgraph-runner.ts](src/workflow/langgraph-runner.ts) and [src/workflow/graph-builder.ts](src/workflow/graph-builder.ts).

**Circuit breaker (optional):** `runWorkflow(..., options?: { circuitBreaker })`. When provided, the full graph invoke runs through the breaker; after a threshold of failures (e.g. 5) the circuit opens and the run fails. The CLI uses this and exits gracefully (exit 1) when the circuit is open. See [src/fault/circuit-breaker.ts](src/fault/circuit-breaker.ts) and [docs/verification.md](verification.md).

When each step runs, the executor builds a **RunContext** via `createRunContext(runtime, step.action, agentLlm)`. That RunContext includes **backbone** (when connected), **invokeCapability** so the capability can call other capabilities it declares in **depends_on**, and **agentLlm** (the current agent’s provider, model, and resolved API key) so capabilities that call the LLM can use it (see [§6.1 Capabilities calling other capabilities](#61-capabilities-calling-other-capabilities)).

---

## 4. Template resolution

**Params** and **condition** strings can contain placeholders:

- **Syntax:** `{{ agentId.key }}` or `{{ agentId.key1.key2 }}` (nested path).
- **Resolution:** Against current `WorkflowContext`: `context[agentId]` then path into that object. Missing agent or key → empty string (in strings) or omitted/false in conditions.
- **Scope:** Simple `{{ id.path }}` only; no expressions inside templates.

Used for:

- **Step params:** `resolveParams(context, step.params)` produces the `CapabilityInput` for that step (recursive over objects/arrays).
- **Condition:** Paths are resolved and evaluated for truthiness (see below).

---

## 5. Condition

- **Optional:** Step may have `condition: string`. If absent, the step runs.
- **Semantics:** Split on `&&`; each part must be a single `{{ agentId.path }}`; all resolved values must be truthy (missing/false/0/"" → false).
- **No full expressions:** Only path-based truthiness in this version (no `==`, etc.).

Example: `"{{ visual_qa.verdict }} && {{ compliance_qa.verdict }}"` — both paths must be truthy.

---

## 6. Step execution

- **Sequential step:** `agent`, `action`, optional `params`, `condition`, `on_failure`. Resolve input from `params` (templates resolved); if condition is false, skip step; else `agent.invoke(action, input, runContext)` and set `context[agent] = output`. The **runContext** is built by `createRunContext(runtime, step.action, agentLlm)` and includes **backbone**, **invokeCapability**, and **agentLlm** (provider, model, apiKey for the step’s agent) (see below).
- **Parallel step:** `parallel: [ ...SequentialStep ]`. Run all via `Promise.all` with the same incoming context; merge outputs by agent id into one context (same key rules as above).
- **Failure:** On throw, the workflow returns `{ success: false, context, error }`; no retries or fallback in this phase.

### 6.1. Capabilities calling other capabilities

Each capability receives a **RunContext** that may include **invokeCapability(capabilityId, input)** and **agentLlm** (the current agent’s provider, model, and API key for LLM calls). This allows a capability to call another capability at runtime and to use the agent’s LLM config when it needs to talk to the model. Allowed targets are declared in the manifest under that capability’s **depends_on** (array of capability ids). Only capabilities listed in the current capability’s **depends_on** may be invoked; calling a capability not in the list throws (e.g. `Capability "X" may not invoke "Y" (not in depends_on).`). Nested invocations get their own scoped RunContext (the callee can only call its own **depends_on**).

**Example (inside a capability’s execute):**

```ts
// Optional chaining: invokeCapability is always present when RunContext is built by the executor
const result = await runContext?.invokeCapability?.("logger", {
  level: "info",
  message: "Step started",
});
```

See [docs/capabilities.md](capabilities.md) for **depends_on** in the YAML and the full **invokeCapability** contract.

---

## 7. Scheduler, heartbeat, and run control

When you run the org **without** `--workflow` (e.g. `daof run org.yaml`), the process starts a **heartbeat** at a configurable interval. On each tick, a **listener** evaluates which workflows have a **cron** trigger that matches the current time; for each due workflow it acquires a slot from a **Redis-backed semaphore** (or in-memory when Redis is unavailable), runs the workflow with an **event_id** and **run_id**, then releases the slot. This allows multiple cron workflows to be driven by one timer without invoking them directly from the timer.

### 7.1. YAML: scheduler config

Optional top-level **scheduler** in the manifest:

```yaml
scheduler:
  heartbeat_interval_seconds: 60   # default 60
  max_concurrent_workflows: 1      # default 1
```

- **heartbeat_interval_seconds:** Interval between heartbeat events (seconds). The timer emits a heartbeat every N seconds; the listener then decides which cron workflows are due.
- **max_concurrent_workflows:** Maximum number of workflow runs at once. Enforced via a Redis semaphore when backbone is Redis; otherwise an in-memory semaphore (single process only).

Schema: [src/schema/index.ts](src/schema/index.ts) (`SchedulerSchema`, defaults in `DEFAULT_HEARTBEAT_INTERVAL_SECONDS`, `DEFAULT_MAX_CONCURRENT_WORKFLOWS`).

### 7.2. Traceability (event_id and run_id)

- **event_id:** Each heartbeat tick generates a new UUID. It is attached to every workflow run triggered by that tick (e.g. in `initialInput.__event_id`) and stored in context/checkpoint metadata for audit.
- **run_id:** Each workflow run has a UUID (e.g. LangGraph thread_id). It is passed in context as `__run_id` and used in checkpoint keys and logs.
- **Propagation:** Both flow through `runWorkflow` → initial context → checkpoints and logs so runs are traceable end-to-end.

### 7.3. Kill workflow

- **Registry:** When a run starts (and a run registry is available, e.g. Redis), the run is registered. When the run ends or is cancelled, it is unregistered and the semaphore slot is released.
- **Cancel:** `daof kill <run_id> <file>` sets a cancel flag in Redis for that run. The runner checks between steps; if the flag is set, it stops, releases the semaphore, and unregisters.
- **Best effort:** Cancellation is between-step only; the in-flight step is not aborted. Requires Redis (same manifest file so Redis URL is known).

CLI: `daof kill <run_id> <file>` — see [CLI](#74-cli-detach-and-pid-file).

### 7.4. CLI: detach and PID file

- **`daof run <file>`** (no `--workflow`): Run the org — start heartbeat and listener, evaluate cron triggers, run due workflows with concurrency control. Process stays in foreground; Ctrl+C stops the scheduler.
- **`daof run <file> -d`** (detach): Same as above but runs in the background. Writes a **PID file** (default `daof.pid` in cwd; override with `--pid-file <path>`). If the PID file already exists and that process is still running, exits with an error (“already running”). On normal exit of the child, the PID file is removed.
- **`daof run <file> --workflow <name>`**: One-shot — run that workflow once and exit. `-d` is not allowed with `--workflow`.

Implementation: [src/workflow/scheduler.ts](src/workflow/scheduler.ts) (heartbeat, orchestrator), [src/backbone/semaphore.ts](src/backbone/semaphore.ts), [src/backbone/run-registry.ts](src/backbone/run-registry.ts), [src/workflow/cron-due.ts](src/workflow/cron-due.ts).

---

## 8. File reference

| Area            | File(s) |
|-----------------|---------|
| Types           | `src/workflow/types.ts` |
| Context / templates / condition | `src/workflow/context.ts` |
| Trigger parsing | `src/workflow/trigger.ts` |
| Execution       | `src/workflow/executor.ts` (delegates to LangGraph runner) |
| LangGraph runner / graph builder | `src/workflow/langgraph-runner.ts`, `src/workflow/graph-builder.ts`, `src/workflow/langgraph-state.ts` |
| Scheduler / heartbeat / cron-due | `src/workflow/scheduler.ts`, `src/workflow/cron-due.ts` |
| Semaphore / run registry | `src/backbone/semaphore.ts`, `src/backbone/run-registry.ts` |
| Checkpoints     | `src/backbone/checkpoint-store.ts`; LangGraph checkpointer per run; final context saved to DAOF store when `runtime.checkpointStore` set |
| Step schema     | `src/schema/index.ts` (SequentialStep, ParallelStep, WorkflowConfig, SchedulerSchema) |
| Input/Output types | `src/types/json.ts` (CapabilityInput, CapabilityOutput, JsonValue) |
