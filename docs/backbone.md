# Backbone

The backbone is the messaging layer (queues) for inter-agent communication and event-driven workflow triggers. The manifest defines it under `backbone`; the runtime connects via an adapter so you can swap Redis, RabbitMQ, or Kafka by changing config.

This page describes the **adapter interface**, **Redis implementation**, **factory and runtime integration**, and **manifest config**. Implementation: `src/backbone/`.

---

## 1. Manifest config

In your org YAML:

```yaml
backbone:
  type: redis                    # redis | rabbitmq | kafka
  config:
    url: redis://localhost:6379
    queues:
      - name: events
        type: pubsub              # pubsub | fifo
      - name: dlq
        type: fifo
```

- **type:** Which backbone to use. Only `redis` is implemented; `rabbitmq` and `kafka` throw at runtime until their adapters exist (see [Backlog](#4-backlog)).
- **config.url:** Connection URL (e.g. Redis connection string).
- **config.queues:** List of named queues. Each has:
  - **name:** Used in `publish(queueName, …)` and `subscribe(queueName, …)`.
  - **type:** `pubsub` (fan-out, no persistence) or `fifo` (list, ordered delivery). Behavior is adapter-specific (see [Redis](#2-redis-adapter)).

Schema: [src/schema/index.ts](src/schema/index.ts) (`BackboneSchema`, `BackboneConfig`).

---

## 2. Adapter interface

All backbones implement the same interface so callers don’t depend on Redis/RabbitMQ/Kafka.

**Types** ([src/backbone/types.ts](src/backbone/types.ts)):

- **BackbonePayload** — `Record<string, unknown> | string`. Adapters serialize objects (e.g. JSON) when publishing.
- **BackboneAdapter** — Interface with four methods:

| Method | Description |
|--------|-------------|
| `connect()` | Connect to the backbone. Idempotent. |
| `disconnect()` | Disconnect and release resources. |
| `publish(queueName, payload)` | Publish a message to the named queue. |
| `subscribe(queueName, handler)` | Subscribe to the named queue. Handler receives raw string (caller may `JSON.parse`). Returns an unsubscribe function. |

Usage pattern:

```ts
const adapter = createBackbone(config.backbone);
await adapter.connect();
const unsub = await adapter.subscribe("events", (msg) => {
  const data = JSON.parse(msg);
  // handle data
});
await adapter.publish("events", { event: "strategy_ready", id: "1" });
// later:
unsub();
await adapter.disconnect();
```

---

## 3. Redis adapter

**File:** [src/backbone/redis-adapter.ts](src/backbone/redis-adapter.ts).

- **Pubsub queues:** Redis `PUBLISH` / `SUBSCRIBE`. Channel name = queue name. Messages are strings (objects are `JSON.stringify`’d).
- **Fifo queues:** Redis list. `LPUSH` to publish, `BRPOP` to consume (blocking). Key = queue name.
- **Connections:** Two Redis clients: one for publish (and fifo `LPUSH`), one for subscribe (and fifo `BRPOP`), so pub/sub and blocking pop don’t block each other.
- **Queue type:** Taken from `config.backbone.config.queues` by queue name; unknown queues default to `pubsub`.

**Dependency:** [ioredis](https://github.com/redis/ioredis) (see `package.json`).

---

## 4. Factory and runtime

**Factory** ([src/backbone/factory.ts](src/backbone/factory.ts)):

- `createBackbone(config: BackboneConfig): BackboneAdapter` — Switches on `config.type` and returns the right adapter. Use this to swap backbones without changing call sites.

**Runtime** ([src/runtime/bootstrap.ts](src/runtime/bootstrap.ts)):

- `bootstrap(config)` does **not** connect to the backbone (so `daof run` and tests don’t require Redis by default).
- **Optional backbone on runtime:** `OrgRuntime` has `backbone?: BackboneAdapter`. The **run path** (`daof run`) calls `connectBackbone(runtime)` before running the workflow so steps can publish. If connection fails (e.g. Redis down), a warning is logged and the workflow runs without backbone.
- **RunContext:** Step execution passes a facade `RunContext` (e.g. `{ backbone: runtime.backbone }`) to `agent.invoke(..., runContext)` and capability `execute(input, runContext)`, so capabilities can call `runContext.backbone?.publish(queueName, payload)` in realtime.
- **Connecting:** Call `connectBackbone(runtime)` after bootstrap when you want the backbone. It creates the adapter from `runtime.config.backbone`, calls `connect()`, and sets `runtime.backbone`. For Redis, it also sets `runtime.checkpointStore` (see [Checkpoint store and keyspaces](#checkpoint-store-and-keyspaces)).

**Checkpoint store and keyspaces:** When using Redis, workflow checkpoints and capability persistence use **separate keyspaces** so they do not collide:
- **`daof:checkpoint:*`** — Workflow state at step boundaries (see [src/backbone/checkpoint-store.ts](src/backbone/checkpoint-store.ts)). Set automatically when `connectBackbone(runtime)` is used with `type: redis`.
- **`daof:capability:*`** — Capability query/store (e.g. tools that read/write Redis). Capabilities must use this prefix so their keys do not overlap with checkpoints.
- **`daof:semaphore:workflows`** — Scheduler concurrency: integer count of current workflow runs (see [src/backbone/semaphore.ts](src/backbone/semaphore.ts)). Used when running the org with a scheduler.
- **`daof:run:<run_id>`** — Active run registry; **`daof:run:<run_id>:cancel`** — Cancel flag set by `daof kill <run_id>` (see [src/backbone/run-registry.ts](src/backbone/run-registry.ts)).

Example (DAOF is intended to be used via the CLI; this example is for reference or integration use):

```ts
import { bootstrap, connectBackbone } from "daof";

const config = validate(loadYaml("org.yaml"));
const runtime = bootstrap(config);
await connectBackbone(runtime);

if (runtime.backbone) {
  await runtime.backbone.publish("events", { event: "strategy_ready" });
}
```

Exports from the package: `createBackbone`, `connectBackbone`, `BackboneAdapter`, `BackbonePayload` (see [src/index.ts](src/index.ts)). Checkpoint store: [src/backbone/checkpoint-store.ts](src/backbone/checkpoint-store.ts) (`CheckpointStore`, `createRedisCheckpointStore`, `CHECKPOINT_KEY_PREFIX`, `CAPABILITY_KEY_PREFIX`).

---

## 5. Tests

**File:** [tests/backbone.test.ts](tests/backbone.test.ts).

- **Factory:** Returns an adapter for `type: redis`; throws for `rabbitmq` and `kafka`.
- **Redis integration:** With Redis running, tests cover connect, publish to a pubsub queue, and subscriber receiving (object and string payloads). To run those tests, start Redis (e.g. `docker run -p 6379:6379 redis`) and set:

  ```bash
  REDIS_AVAILABLE=1 npm test
  ```

  Without `REDIS_AVAILABLE=1`, the Redis integration tests are skipped so CI passes without Redis.

---

## 6. Backlog

| Adapter | Status | Notes |
|---------|--------|--------|
| **RabbitMQ** | Not implemented | Implement `BackboneAdapter` for `type: "rabbitmq"` and add a case in `createBackbone()`. Consider amqplib or amqp-connection-manager. |
| **Kafka** | Not implemented | Implement `BackboneAdapter` for `type: "kafka"` and add a case in `createBackbone()`. Consider kafkajs. |

Traceability and backlog are also in [docs/verification.md](verification.md).
