# Capabilities

Capabilities are reusable building blocks (tools, skills, or hybrids) that agents invoke in workflow steps. This page describes **capability types** (including **skills**), **capability-to-capability calls** and the **depends_on** / **invokeCapability** contract, and **persistence**.

---

## Generating capabilities

Use **`daof build "<description>"`** to generate capabilities, workflows, and agents from a natural-language description. The flow: a **Planner** produces a PRD from your prompt; you are asked to proceed (y/n) unless you pass **`--yolo`**; then a **Generator** produces YAML definitions; a **similarity check** runs (registry metadata check when MongoDB is configured, plus capability `verify_similarity` for semantic duplicates) to avoid duplicate or near-duplicate capabilities/agents; then definitions are merged into your org manifest (default: **`org.yaml`** in the current directory; override with **`--file <path>`**). See [registry.md](registry.md) for the skills/capabilities registry and **`daof registry sync`** / **`query_capability_registry`**. **Codegen** is on by default: for each new **tool** capability (not bundled and not a skill), the build generates TypeScript implementation source under **`--codegen-dir`** (default `generated/capabilities`), sets the capability’s **`source`** in the manifest, and re-writes the org file. Run **`npm run build`** to compile and include the new capabilities. Use **`--no-codegen`** to disable codegen. With **`--bundle`**, generated tool capabilities are written into the framework (**`src/capabilities/bundled/<id>.ts`**) and the bundled index is updated so the capability is resolved as a bundled capability (no **`source`** in the org); you must run from the **DAOF repo root**. See [build-flow.md](build-flow.md#--bundle-add-capability-to-framework-source). A **Verifier** checks the result against the PRD; on failure the build retries up to 5 times. The same LLM provider as workflows is used (e.g. Cursor; set `CURSOR_API_KEY`). Capabilities with **`source`** are loaded at runtime via dynamic import (path relative to process cwd). Prefer **skills** for prompt/LLM-driven behavior when you don’t need custom tool code.

---

## Capability types

- **tool:** Executable tools (HTTP, logging, key-value store, etc.). Bundled implementations, **source** (generated or repo), or inline-tool adapter.
- **skill:** Prompt-template capability. Uses a `prompt` string with `{{ key }}` (or `{{ key.nested }}`) placeholders resolved from input; optionally calls an LLM at `config.endpoint` (same pattern as text_generator). Skills can use **depends_on** and **invokeCapability** like tools (e.g. a skill that composes a logger or another skill).
- **hybrid:** Reserved for future use.

Skills are loaded when `type: "skill"` is set and no bundled implementation exists for that capability id. See [Skill runner](#skill-runner) below.

---

## Capability-to-capability calls and depends_on

A capability can call another capability at runtime. This is controlled by the manifest and the **RunContext** passed into each capability’s `execute(input, runContext)`.

### depends_on (YAML)

In the org manifest, each capability definition may include an optional **depends_on** field: an array of capability ids that this capability is allowed to call.

- **Ids** in `depends_on` must refer to capabilities defined in the same **capabilities** map (same manifest).
- If a capability does not list another capability in **depends_on**, it must not call it; the runtime enforces this and throws if the capability tries to invoke a non-allowed target.

Example:

```yaml
capabilities:
  logger:
    type: tool
    description: Log messages
  assemble_and_post:
    type: tool
    description: Assemble and post
    depends_on:
      - logger
      - post_to_x
```

Here, `assemble_and_post` may call `logger` and `post_to_x` at runtime. It may not call any other capability.

### RunContext.invokeCapability(capabilityId, input)

When the workflow engine runs a step, it builds a **RunContext** for that step’s capability. The RunContext includes:

- **backbone** (optional): for publishing to queues (see [backbone.md](backbone.md)).
- **invokeCapability(capabilityId, input?)**: async function to run another capability by id.
- **registry** (optional): when the skills/capabilities registry (MongoDB) is connected, for metadata search (e.g. **query_capability_registry**). See [registry.md](registry.md).
- **updateOrgConfig** (optional, daemon mode only): when the org is running as the long-running scheduler, capabilities that would normally write the org file (e.g. **merge_and_write**) receive this callback and should call it with the updated config instead of writing to disk; the file is synced on daemon shutdown. See [workflow-engine.md](workflow-engine.md#daemon-mode-in-memory-org-sync-on-shutdown).
- **getCurrentOrgConfig** (optional, daemon mode only): returns the current in-memory org config so capabilities can use it as the base for merge/patch (e.g. **merge_and_write** uses it when present so a second build in the same run merges on top of the first).

**Signature:**

```ts
invokeCapability?(
  capabilityId: string,
  input?: CapabilityInput
): Promise<CapabilityOutput>;
```

**Behavior:**

- If **capabilityId** is not in the current capability’s **depends_on** list, the runtime throws (e.g. `Capability "X" may not invoke "Y" (not in depends_on).`).
- If the capability id is not found in the registry, the runtime throws (e.g. `Capability not found: Y`).
- Otherwise, the runtime looks up the target capability, builds a **nested RunContext** for the callee (so the callee’s `invokeCapability` is scoped to the callee’s own **depends_on**), and runs `target.execute(input ?? {}, nestedRunContext)`.
- The returned promise resolves to the callee’s **CapabilityOutput**.

So capabilities do **not** receive the raw capability registry; they receive a RunContext that exposes only this invoker, which applies the **depends_on** whitelist. Nested calls get their own scoped RunContext. **Skills** use the same contract: list other capabilities in **depends_on** and call `runContext.invokeCapability(capabilityId, input)` from inside the skill’s execute.

### Cycles

If capability A has `depends_on: [B]` and B has `depends_on: [A]`, nested calls are allowed and can recurse until stack overflow. This version does not validate **depends_on** as a DAG or disallow re-entrancy; that may be added later.

---

## Authentication for external capabilities

Capabilities that call external HTTP APIs use **config-based authentication** via a strategy/adapter pattern. In the manifest, set **`config.auth.strategy`** (e.g. `bearer`, `api_key`, `basic`) and the strategy-specific credentials under `config.auth`. Credentials must use `env(VAR)`; see [authentication.md](authentication.md) for full detail and examples.

Bundled capabilities that support auth: **ImageGenerator**, **TextGenerator**, **SentimentAnalyzer**, **XPoster**, **MetricsFetcher**, **WebhookNotifier** (optional auth for outbound POST).

### XPoster (Twitter API v2 SDK)

The **x_poster** capability uses the [twitter-api-v2](https://www.npmjs.com/package/twitter-api-v2) SDK to post tweets via the Twitter API v2. It does not use the generic HTTP auth registry; credentials are supplied in the capability **config** and resolved with `env(VAR)` at bootstrap.

- **Input:** `content` (required), `media_urls?` (optional; media support may be added later).
- **Output:** `{ post_id }` on success, or `{ ok: false, error }` on failure.
- **Config (OAuth 1.0a):** For real posting, set all four (use `env(...)` for secrets): `app_key`, `app_secret`, `access_token`, `access_token_secret`. These correspond to your Twitter app consumer key/secret and the user access token/secret. If any credential is missing or empty, the capability returns `{ post_id: "stub" }` without calling the API.
- **Config (dry-run):** Set `dry_run: true` (or `dry_run: env(DRY_RUN)` with `DRY_RUN=true`) to run the workflow without posting to X. The capability validates input and returns `{ post_id: "dry-run", dry_run: true }` without calling the Twitter API.

---

## Skill runner

When a capability has **type: "skill"** and no bundled implementation by id, the loader instantiates a **skill runner** that:

- Reads **prompt** from the manifest (template string).
- Resolves `{{ key }}` and `{{ key.nested }}` from the capability **input**. When the skill runs in a workflow step, the runner also injects reserved placeholders from the run context (runContext values override input): **`{{ step_id }}`** (current step UUID), **`{{ run_id }}`** (workflow run ID), and **`{{ agent_id }}`** (id of the agent executing the step). So prompts can use these without passing them in params.
- If **config.endpoint** is set, POSTs the rendered prompt to that endpoint (same request shape and auth as TextGenerator) and returns `{ text }` from the response.
- If no endpoint is set, returns `{ text: renderedPrompt }`.

Skills can declare **depends_on** and call **runContext.invokeCapability** from inside their execute to compose other capabilities.

---

## Middleware (agent and capability pipeline)

The runtime can run **middleware** at **agent** and **capability** level. Middleware is configured in the org manifest under **`middleware`** and runs on every agent invoke and every capability execution (including nested `invokeCapability`).

### YAML config

```yaml
middleware:
  agent:
    - agent_metrics   # built-in: records duration and success per agent
  capability: []      # optional capability-level middlewares
```

- **agent**: list of agent middleware names. Order is preserved (first runs first). Built-in: **agent_metrics** (records step duration and success into the metrics store so `fetch_agent_performance` "report" can read them).
- **capability**: list of capability middleware names. No built-ins by default; use the registry to add custom capability middlewares by name.

When **`middleware`** is omitted or the arrays are empty, no middleware runs (same behavior as before). Unknown middleware names cause bootstrap to fail with a clear error (e.g. "Unknown agent middleware: foo. Known: agent_metrics.").

### Metrics store and fetch_agent_performance

When the backbone provides a capability store (e.g. Redis), **connectBackbone** also sets **runtime.metricsStore** (a scoped store for agent metrics). The **agent_metrics** middleware and the **fetch_agent_performance** capability both use this store when available (RunContext carries **metricsStore** when set). So enabling `agent_metrics` in YAML and using a backbone with a capability store gives you automatic per-agent step recording; call the **fetch_agent_performance** capability with action **"report"** to read aggregated stats.

---

## Persistence

A capability definition can set **persistence** (e.g. `"redis"`) in the manifest. When set and the runtime has a **capability store** (e.g. after `connectBackbone(runtime)` with Redis), the RunContext passed to that capability includes a **scoped** store: all keys are prefixed by capability id so each capability’s data is isolated (keyspace effectively `daof:capability:{capabilityId}:*`). Capabilities without **persistence** do not receive a store. Use this for capabilities that need to remember or cache data across runs (e.g. key-value state, caches).

---

## File reference

| Area            | File(s) |
|-----------------|---------|
| RunContext type and factory | `src/runtime/run-context.ts` |
| Schema (depends_on, persistence, type, prompt) | `src/schema/index.ts` (CapabilityDefinitionSchema) |
| Skill runner | `src/capabilities/bundled/skill_runner.ts` |
| Scoped store | `src/backbone/capability-store.ts` (createScopedCapabilityStore) |
| Step execution (builds RunContext) | `src/workflow/executor.ts` |

**Security:** Do not pass secrets or PII into the Logger capability or into ticket update message/payload; see [RISKS.md](../RISKS.md) for accepted risks and operational guidance.
