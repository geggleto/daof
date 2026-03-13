# API Reference — Full type and signature map

This document lists the public API of the DAOF codebase with full TypeScript-style types and return types. Use it for precise reasoning about parameters, return values, and type shapes. Module-by-module, by area.

---

## 1. Parser / Config / Types

### src/types/json.ts

**Types**

```ts
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type ParsedYaml = JsonValue;

type CapabilityInput = Record<string, JsonValue>;

type CapabilityOutput = Record<string, JsonValue>;

interface CapabilityInstance {
  execute(
    input: CapabilityInput,
    runContext?: RunContext
  ): Promise<CapabilityOutput>;
}
```

**Exports**

- `JsonValue` — recursive JSON-serializable value
- `ParsedYaml` — same shape as JsonValue; raw YAML parse result
- `CapabilityInput` — input to a capability execute call
- `CapabilityOutput` — output from a capability execute call
- `CapabilityInstance` — interface with `execute(input, runContext?) => Promise<CapabilityOutput>`
- `JsonValueSchema` — `z.ZodType<JsonValue>` (Zod schema)

---

### src/parser/index.ts

**Functions**

```ts
function loadYaml(filePath: string): ParsedYaml;

function validate(raw: ParsedYaml): OrgConfig;
```

- `loadYaml` — load and parse a YAML file; no env resolution
- `validate` — validate raw parsed YAML against manifest schema; throws ZodError on invalid; re-exports schema validate

---

### src/config/resolve-env.ts

**Functions**

```ts
function resolveEnv(config: OrgConfig): OrgConfig;
```

- `resolveEnv` — return a copy of config with all `env(VAR_NAME)` string values replaced by `process.env[VAR_NAME]`

---

## 2. Schema

### src/schema/index.ts

**Types (Zod-inferred)**

```ts
type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;
type AgentConfig = z.infer<typeof AgentSchema>;
type SequentialStep = z.infer<typeof SequentialStepSchema>;
type ParallelStep = z.infer<typeof ParallelStepSchema>;
type WorkflowConfig = z.infer<typeof WorkflowSchema>;
type SchedulerConfig = z.infer<typeof SchedulerSchema>;
type BackboneConfig = z.infer<typeof BackboneSchema>;
type OrgConfig = z.infer<typeof OrgSchema>;
```

**Constants**

```ts
const DEFAULT_HEARTBEAT_INTERVAL_SECONDS: number;  // 60
const DEFAULT_MAX_CONCURRENT_WORKFLOWS: number;    // 1
```

**Functions**

```ts
function validate(raw: ParsedYaml): OrgConfig;
```

**Exports**

- `OrgSchema` — Zod schema for the org root
- All types above; `validate(raw)` parses and returns `OrgConfig` or throws

---

## 3. Runtime

### src/runtime/bootstrap.ts

**Types**

```ts
interface OrgRuntime {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  agents: Map<string, Agent>;
  /** When set, this process is the long-running daemon; config is synced to this path on shutdown. */
  orgFilePath?: string;
  backbone?: BackboneAdapter;
  checkpointStore?: CheckpointStore;
  capabilityStore?: CapabilityStore;
  metricsStore?: CapabilityStore;
  /** Skills/capabilities registry (MongoDB). Required for running workflows. */
  registry?: RegistryStore;
  /** Ticket store (MongoDB) for run observability. Required for running workflows. */
  ticketStore?: TicketStore;
  agentMiddleware?: AgentMiddleware[];
  capabilityMiddleware?: CapabilityMiddleware[];
}
```

**Functions**

```ts
function bootstrap(config: OrgConfig): OrgRuntime;

function connectBackbone(runtime: OrgRuntime): Promise<void>;
```

- `bootstrap` — resolve env refs, load capabilities, resolve config.middleware via registry (agent/capability pipeline), bootstrap agents; connects to MongoDB for registry and ticket store (required; throws on connection failure); does not connect backbone
- `connectBackbone` — create adapter from config, connect, set `runtime.backbone`; when adapter exposes `createCheckpointStore`/`createCapabilityStore`, attaches those to runtime and sets `runtime.metricsStore` (scoped store for agent metrics)

### src/runtime/middleware.ts

**Types**

```ts
interface RuntimeWithMiddleware {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  capabilityStore?: CapabilityStore;
  metricsStore?: CapabilityStore;
  agentMiddleware?: AgentMiddleware[];
  capabilityMiddleware?: CapabilityMiddleware[];
}

type AgentMiddleware = (
  ctx: AgentMiddlewareContext,
  next: () => Promise<CapabilityOutput>
) => Promise<CapabilityOutput>;

type CapabilityMiddleware = (
  ctx: CapabilityMiddlewareContext,
  next: () => Promise<CapabilityOutput>
) => Promise<CapabilityOutput>;
```

**Functions**

```ts
function runAgentPipeline(
  middlewares: AgentMiddleware[],
  ctx: AgentMiddlewareContext,
  next: () => Promise<CapabilityOutput>
): Promise<CapabilityOutput>;

function runCapabilityPipeline(
  middlewares: CapabilityMiddleware[],
  ctx: CapabilityMiddlewareContext,
  next: () => Promise<CapabilityOutput>
): Promise<CapabilityOutput>;

function executeCapabilityWithMiddleware(
  runtime: RuntimeWithMiddleware,
  capabilityId: string,
  instance: CapabilityInstance,
  input: CapabilityInput,
  runContext: RunContext,
  agentId?: string
): Promise<CapabilityOutput>;
```

### src/runtime/agent-metrics-store.ts

Shared storage helpers for agent step metrics (used by fetch_agent_performance and agent_metrics middleware). **Functions:** `recordAgentStep(store, agentId, durationMs, success, qualityScore?)`, `loadAgentIndex(store)`, `loadAgentMetrics(store, agentId)`, `buildAgentReport(metrics, lookbackMs)`.

### src/runtime/middleware-registry.ts

Maps middleware names (e.g. `agent_metrics`) to factory functions. **Functions:** `resolveAgentMiddlewares(names, runtime)`, `resolveCapabilityMiddlewares(names, runtime)`, `registerAgentMiddleware(name, factory)`, `registerCapabilityMiddleware(name, factory)`, `getKnownAgentMiddlewareNames()`, `getKnownCapabilityMiddlewareNames()`. Unknown names throw at resolve.

### src/runtime/run-org.ts

**Functions**

```ts
function runScheduler(
  runtime: OrgRuntime,
  options?: RunSchedulerOptions
): Promise<void>;
```

- `runScheduler` — starts heartbeat and event subscriber; uses `runtime.backbone?.createWorkflowSemaphore`/`createRunRegistry` when present (e.g. Redis), else in-memory semaphore and no run registry. Options: `onBeforeShutdown` (e.g. remove PID file). When `runtime.orgFilePath` is set, shutdown writes `runtime.config` to that path before calling `onBeforeShutdown` and exiting; on write failure logs and exits with code 1. Resolves after setup; process stays alive until SIGINT/SIGTERM.

---

### src/runtime/run-context.ts

**Types**

```ts
interface AgentLlm {
  provider: string;
  model: string;
  apiKey?: string;
}

interface RunContext {
  backbone?: BackboneAdapter;
  invokeCapability?(capabilityId: string, input?: CapabilityInput): Promise<CapabilityOutput>;
  capabilityStore?: CapabilityStore;
  metricsStore?: CapabilityStore;
  /** Current agent's provider/model/API key for LLM calls; passed from executor, inherited in nested invocations. */
  agentLlm?: AgentLlm;
  /** When present, skills/capabilities registry for metadata search (query_capability_registry, etc.). */
  registry?: RegistryStore;
  /** When present (daemon mode), capabilities should call this to replace the in-memory org config instead of writing to disk. */
  updateOrgConfig?: (config: OrgConfig) => void;
  /** When present (daemon mode), capabilities use this as the current config for merge/patch so the base is in-memory state. */
  getCurrentOrgConfig?: () => OrgConfig;
  /** When present (workflow run), capabilities can append updates to the run ticket (observability). */
  ticket?: { id: string; append(update: Omit<TicketUpdate, "at">): Promise<void> };
}

interface RunInfo {
  workflowId: string;
  runId: string;
}

interface RunContextFactoryDeps {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  backbone?: BackboneAdapter;
  capabilityStore?: CapabilityStore;
  metricsStore?: CapabilityStore;
  registry?: RegistryStore;
  ticketStore?: TicketStore;
  capabilityMiddleware?: CapabilityMiddleware[];
  /** When set (daemon mode), createRunContext sets updateOrgConfig and getCurrentOrgConfig on the returned context. */
  orgFilePath?: string;
}
```

**Functions**

```ts
function createRunContext(
  deps: RunContextFactoryDeps,
  currentCapabilityId: string,
  agentLlm?: AgentLlm,
  runInfo?: RunInfo
): RunContext;
```

---

## 4. Tickets (observability)

### src/tickets/types.ts

**Types**

```ts
type TicketStatus = "running" | "completed" | "failed";

interface TicketUpdate {
  at: string;
  agent_id?: string;
  capability_id?: string;
  step?: string;
  message?: string;
  payload?: Record<string, JsonValue>;
}

interface Ticket {
  _id: string;
  workflow_id: string;
  run_id: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  updates: TicketUpdate[];
  initial_input?: Record<string, JsonValue>;
}

interface TicketMeta {
  workflow_id: string;
  run_id: string;
  initial_input?: Record<string, JsonValue>;
}

interface TicketStore {
  create(ticketId: string, meta: TicketMeta): Promise<void>;
  appendUpdate(ticketId: string, update: Omit<TicketUpdate, "at">): Promise<void>;
  setStatus(ticketId: string, status: TicketStatus): Promise<void>;
  get(ticketId: string): Promise<Ticket | null>;
}
```

### src/tickets/ticket-store.ts

**Functions**

```ts
function createTicketStore(mongoUri: string): Promise<TicketStore>;
```

- Uses DB `daof_tickets`, collection `tickets`. Same Mongo URI as registry (REGISTRY_MONGO_URI / MONGO_URI).

---

## 5. Workflow

### src/workflow/types.ts

**Types**

```ts
type WorkflowContext = Record<string, CapabilityOutput>;

interface WorkflowRunResult {
  success: boolean;
  context: WorkflowContext;
  error?: Error;
  /** Run/ticket ID for observability (daof ticket <runId>). */
  runId?: string;
}

interface CronTrigger {
  type: "cron";
  expression: string;
}

interface EventTrigger {
  type: "event";
  eventName: string;
}

type ParsedTrigger = CronTrigger | EventTrigger;
```

**Class**

```ts
class WorkflowCancelledError extends Error {
  readonly runId: string;
  constructor(runId: string);
}
```

---

### src/workflow/trigger.ts

**Functions**

```ts
function parseTrigger(trigger: string): ParsedTrigger;
```

- Throws on unsupported trigger format. Accepts `cron(<expression>)` and `event(<eventName>)`.

---

### src/workflow/context.ts

**Functions**

```ts
function resolveTemplate(context: WorkflowContext, str: string): string;

function resolveParams(context: WorkflowContext, params: Record<string, JsonValue>): CapabilityInput;

function evaluateCondition(context: WorkflowContext, condition: string): boolean;
```

---

### src/workflow/executor.ts

**Types**

```ts
interface RunWorkflowOptions {
  circuitBreaker?: CircuitBreaker;
  runRegistry?: RunRegistry | null;
}
```

**Functions**

```ts
function executeStep(
  runtime: OrgRuntime,
  step: SequentialStep | ParallelStep,
  context: WorkflowContext
): Promise<WorkflowContext>;

function executeParallelStep(
  runtime: OrgRuntime,
  step: ParallelStep,
  context: WorkflowContext
): Promise<WorkflowContext>;

function runWorkflow(
  runtime: OrgRuntime,
  workflowId: string,
  initialInput?: CapabilityInput,
  options?: RunWorkflowOptions
): Promise<WorkflowRunResult>;
```

---

### src/workflow/langgraph-runner.ts

**Types**

```ts
interface LangGraphRunOptions {
  circuitBreaker?: CircuitBreaker;
  runRegistry?: RunRegistry | null;
}
```

**Functions**

```ts
function runWorkflowWithLangGraph(
  runtime: OrgRuntime,
  workflowId: string,
  initialInput?: CapabilityInput,
  runId?: string,
  options?: LangGraphRunOptions
): Promise<WorkflowRunResult>;
```

---

### src/workflow/graph-builder.ts

**Functions**

```ts
function buildWorkflowGraph(
  runtime: OrgRuntime,
  workflow: WorkflowConfig,
  runRegistry?: RunRegistry | null
): StateGraph<typeof WorkflowStateAnnotation, WorkflowState, WorkflowStateUpdate, string>;
```

- Returns a LangGraph `StateGraph`; when `runRegistry` is provided, nodes check for cancellation between steps.

---

### src/workflow/langgraph-state.ts

**Exports**

```ts
const WorkflowStateAnnotation: AnnotationRoot<{ context: ... }>;
type WorkflowState = (typeof WorkflowStateAnnotation)["State"];
type WorkflowStateUpdate = (typeof WorkflowStateAnnotation)["Update"];
```

- Single channel `context` (WorkflowContext) with reducer merge.

---

### src/workflow/scheduler.ts

**Types**

```ts
interface HeartbeatPayload {
  event_id: string;
  at: number;
}
```

**Functions**

```ts
function startHeartbeat(
  runtime: OrgRuntime,
  onHeartbeat: (payload: HeartbeatPayload) => void | Promise<void>
): () => void;

function onHeartbeatRunDueWorkflows(
  runtime: OrgRuntime,
  payload: HeartbeatPayload,
  semaphore: WorkflowSemaphore,
  runRegistry: RunRegistry | null
): Promise<void>;
```

- `startHeartbeat` — returns a stop function (clearInterval).
- `onHeartbeatRunDueWorkflows` — finds cron workflows that are due, acquires semaphore, runs workflow with event_id, releases in finally.

---

### src/workflow/cron-due.ts

**Functions**

```ts
function isCronDue(expression: string, date?: Date): boolean;
```

- Returns true if the cron expression would fire in the current minute of the given date (default now).

---

## 6. Backbone

### src/backbone/types.ts

**Types**

```ts
type BackbonePayload = Record<string, JsonValue> | string;

interface BackboneAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(queueName: string, payload: BackbonePayload): Promise<void>;
  subscribe(
    queueName: string,
    handler: (payload: string) => void | Promise<void>
  ): Promise<() => void>;
  createWorkflowSemaphore?(maxConcurrent: number): WorkflowSemaphore;
  createRunRegistry?(): (RunRegistry & RunRegistryCancel) | null;
  createCheckpointStore?(): CheckpointStore;
  createCapabilityStore?(): CapabilityStore;
}
```

- Optional methods expose backend-specific features; callers use them when present instead of branching on `config.backbone.type`. Redis adapter implements all four.

---

### src/backbone/factory.ts

**Functions**

```ts
function createBackbone(config: BackboneConfig): BackboneAdapter;
```

- Throws for `rabbitmq` and `kafka` (not implemented). Redis returns adapter from `createRedisAdapter`.

---

### src/backbone/redis-adapter.ts

**Functions**

```ts
function createRedisAdapter(config: BackboneConfig): BackboneAdapter;
```

- Requires `config.type === "redis"`. Uses PUBLISH/SUBSCRIBE for pubsub queues, LPUSH/BRPOP for fifo.

---

### src/backbone/semaphore.ts

**Types**

```ts
interface WorkflowSemaphore {
  acquire(): Promise<boolean>;
  release(): Promise<void>;
}
```

**Functions**

```ts
function createRedisWorkflowSemaphore(
  redisUrl: string,
  maxConcurrent: number
): WorkflowSemaphore;

function createInMemoryWorkflowSemaphore(maxConcurrent: number): WorkflowSemaphore;
```

---

### src/backbone/run-registry.ts

**Types**

```ts
interface RunRegistry {
  register(runId: string): Promise<void>;
  unregister(runId: string): Promise<void>;
  isCancelled(runId: string): Promise<boolean>;
}

interface RunRegistryCancel {
  requestCancel(runId: string): Promise<void>;
}
```

**Functions**

```ts
function createRedisRunRegistry(redisUrl: string): RunRegistry & RunRegistryCancel;
```

---

### src/backbone/checkpoint-store.ts

**Constants**

```ts
const CHECKPOINT_KEY_PREFIX: string;  // "daof:checkpoint:"
const CAPABILITY_KEY_PREFIX: string;  // "daof:capability:"
```

**Types**

```ts
interface CheckpointStore {
  save(
    workflowId: string,
    runId: string,
    stepIndex: number,
    context: WorkflowContext
  ): Promise<void>;
  load(
    workflowId: string,
    runId: string,
    stepIndex: number
  ): Promise<WorkflowContext | null>;
}
```

**Functions**

```ts
function createRedisCheckpointStore(redisUrl: string): CheckpointStore;
```

---

### src/backbone/capability-store.ts

**Types**

```ts
interface CapabilityStore {
  get(key: string): Promise<JsonValue | null>;
  set(key: string, value: JsonValue): Promise<void>;
  delete(key: string): Promise<void>;
}
```

**Functions**

```ts
function createScopedCapabilityStore(
  capabilityId: string,
  underlying: CapabilityStore
): CapabilityStore;

function createRedisCapabilityStore(redisUrl: string): CapabilityStore;
```

---

## 7. Capabilities

### src/capabilities/load.ts

**Functions**

```ts
function loadCapabilities(
  config: OrgConfig,
  resolvers?: CapabilityResolver[]
): Map<string, CapabilityInstance>;
```

- When `resolvers` is omitted, uses default (bundled, skill, inline-tool). Pass custom resolvers to plug in other capability sources. Throws if any capability has `source` (repo-pulled not supported). `CapabilityResolver`: `(id, def) => CapabilityInstance | undefined`.

---

### src/capabilities/types.ts

Re-exports: `CapabilityInstance`, `CapabilityInput`, `CapabilityOutput` from `../types/json.js`.

---

### src/capabilities/adapters/inline-tool.ts

**Functions**

```ts
function createInlineToolInstance(
  capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance;
```

- If config has `endpoint`, uses HTTP POST; otherwise stub that echoes input.

---

### src/capabilities/auth/types.ts

**Types**

```ts
interface AuthStrategy {
  getHeaders(config: Record<string, JsonValue>): Record<string, string>;
}
```

---

### src/capabilities/auth/registry.ts

**Functions**

```ts
function getAuthStrategy(name: string): AuthStrategy | undefined;

function getAuthHeaders(
  strategyName: string,
  config: Record<string, JsonValue>
): Record<string, string>;

function getAuthHeadersFromCapabilityConfig(
  config: Record<string, JsonValue> | undefined
): Record<string, string>;
```

- Registered strategies: `bearer`, `api_key`, `basic`.

---

### src/capabilities/bundled/index.ts

**Types**

```ts
type BundledCapabilityFactory = (
  capabilityId: string,
  def: CapabilityDefinition
) => CapabilityInstance;
```

**Constants**

```ts
const BUNDLED_IDS: Set<string>;
```

**Functions**

```ts
function getBundledCapability(
  capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance | undefined;
```

- Bundled ids include: logger, event_emitter, webhook_notifier, key_value_store, image_generator, text_generator, sentiment_analyzer, x_poster, metrics_fetcher, file_uploader, plus skill_runner for type "skill".

---

## 8. Providers

Provider execution is behind a service layer: capabilities use `LLMProviderService` and `getProviderService`; each provider (e.g. Cursor) implements the interface. See [docs/providers.md](providers.md).

### src/providers/llm-provider-service.ts

**Types**

```ts
interface LLMProviderService {
  complete(
    prompt: string,
    options?: { max_tokens?: number }
  ): Promise<{ text: string } | { ok: false; error: string }>;
}
```

### src/providers/cursor-service.ts

Cursor implementation of `LLMProviderService` (CLI spawn, `CURSOR_CLI_CMD`, `CURSOR_API_KEY`). Created via `createCursorProviderService(apiKey: string)`.

### src/providers/registry.ts

Provider definitions are code-only (no YAML). MVP: Cursor only; API key from `CURSOR_API_KEY` env var.

**Types**

```ts
interface ProviderDefinition {
  id: string;
  apiKeyEnvVar: string;
}
```

**Constants**

```ts
const KNOWN_PROVIDER_IDS: string[];
```

**Functions**

```ts
function isKnownProvider(id: string): boolean;

function getProvider(id: string): ProviderDefinition | undefined;

function getProviderApiKey(providerId: string): string | undefined;

function getProviderService(
  providerId: string,
  apiKey: string | undefined
): LLMProviderService | undefined;
```

- `isKnownProvider` — true if the id is in the registry (e.g. `"cursor"`).
- `getProvider` — returns the provider definition or undefined.
- `getProviderApiKey` — returns `process.env[provider.apiKeyEnvVar]` when provider exists.
- `getProviderService` — returns an `LLMProviderService` for the given provider and API key (e.g. Cursor); undefined if unknown or API key missing.

**Registration (data-driven)**

```ts
type ProviderServiceFactory = (apiKey: string) => LLMProviderService;

function registerProviderServiceFactory(
  providerId: string,
  factory: ProviderServiceFactory
): void;
```

- New providers register via `registerProviderServiceFactory` (e.g. from `src/providers/register-providers.ts`); no edit to `getProviderService` required.

---

## 9. Agents

### src/agents/agent.ts

**Types**

```ts
interface Agent {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly role: string;
  readonly fallback: string | undefined;
  readonly maxConcurrentTasks: number | undefined;
  invoke(
    action: string,
    input?: CapabilityInput,
    runContext?: RunContext
  ): Promise<CapabilityOutput>;
}
```

**Functions**

```ts
function createAgent(
  id: string,
  provider: string,
  model: string,
  role: string,
  capabilities: Map<string, CapabilityInstance>,
  fallback: string | undefined,
  maxConcurrentTasks: number | undefined
): Agent;
```

---

### src/agents/bootstrap.ts

**Functions**

```ts
function bootstrapAgents(
  config: OrgConfig,
  capabilities: Map<string, CapabilityInstance>
): Map<string, Agent>;
```

---

## 10. Fault

### src/fault/circuit-breaker.ts

**Constants**

```ts
const DEFAULT_FAILURE_THRESHOLD: number;  // 5
const DEFAULT_TIMEOUT_MS: number;         // 30000
```

**Functions**

```ts
function createAppCircuitBreaker(options?: {
  failureThreshold?: number;
  timeoutMs?: number;
  windowSizeMs?: number;
}): CircuitBreaker;
```

- `CircuitBreaker` from `p-circuit-breaker`. When circuit opens, `execute()` throws.

---

## 11. CLI

### src/cli/pidfile.ts

**Functions**

```ts
function getPidFilePath(pidFileOption?: string): string;

function isProcessAlive(pid: number): boolean;

function readPidFile(path: string): number | null;

function writePidFile(path: string): void;

function removePidFile(path: string): void;

function checkAlreadyRunning(pidFilePath: string): void;
```

- `checkAlreadyRunning` — if PID file exists and process is alive, logs error and `process.exit(1)`.

---

## 12. Package entry (src/index.ts)

**Exports**

```ts
export { loadYaml, validate } from "./parser/index.js";
export { bootstrap, connectBackbone } from "./runtime/bootstrap.js";
export type { OrgConfig } from "./schema/index.js";
export type { OrgRuntime } from "./runtime/bootstrap.js";
export type { RunContext } from "./runtime/run-context.js";
export type { BackboneAdapter, BackbonePayload } from "./backbone/types.js";
export { createBackbone } from "./backbone/factory.js";
export type { RunWorkflowOptions } from "./workflow/executor.js";
export { createAppCircuitBreaker } from "./fault/circuit-breaker.js";
export type {
  CapabilityInput,
  CapabilityInstance,
  CapabilityOutput,
  JsonValue,
  ParsedYaml,
} from "./types/json.js";
```

- No `runWorkflow` re-export from the package; use workflow/executor or scheduler for run/orchestration. CLI and scheduler import from workflow and backbone directly. For MVP, the supported usage is the CLI; the package exports are available for integration or tooling.
