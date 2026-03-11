# Capabilities

Capabilities are reusable building blocks (tools, skills, or hybrids) that agents invoke in workflow steps. This page describes **capability types** (including **skills**), **capability-to-capability calls** and the **depends_on** / **invokeCapability** contract, and **persistence**.

---

## Capability types

- **tool:** Executable tools (HTTP, logging, key-value store, etc.). Bundled implementations or inline-tool adapter.
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

---

## Skill runner

When a capability has **type: "skill"** and no bundled implementation by id, the loader instantiates a **skill runner** that:

- Reads **prompt** from the manifest (template string).
- Resolves `{{ key }}` and `{{ key.nested }}` from the capability **input**.
- If **config.endpoint** is set, POSTs the rendered prompt to that endpoint (same request shape and auth as TextGenerator) and returns `{ text }` from the response.
- If no endpoint is set, returns `{ text: renderedPrompt }`.

Skills can declare **depends_on** and call **runContext.invokeCapability** from inside their execute to compose other capabilities.

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
