import type { OrgConfig } from "../schema/index.js";
import type { Agent } from "../agents/agent.js";
import type { CapabilityInstance } from "../types/json.js";
import type { BackboneAdapter } from "../backbone/types.js";
import type { CheckpointStore } from "../backbone/checkpoint-store.js";
import type { CapabilityStore } from "../backbone/capability-store.js";
export type { RunContext } from "./run-context.js";
import { resolveEnv } from "../config/resolve-env.js";
import { loadCapabilities } from "../capabilities/load.js";
import { bootstrapAgents } from "../agents/bootstrap.js";
import { createBackbone } from "../backbone/factory.js";
import { createRedisCheckpointStore } from "../backbone/checkpoint-store.js";
import { createRedisCapabilityStore } from "../backbone/capability-store.js";

export interface OrgRuntime {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  agents: Map<string, Agent>;
  /** Set when backbone is connected (e.g. via connectBackbone). */
  backbone?: BackboneAdapter;
  /** Set when backbone is Redis (uses keyspace daof:checkpoint:*). */
  checkpointStore?: CheckpointStore;
  /** Set when backbone is Redis (uses keyspace daof:capability:*). */
  capabilityStore?: CapabilityStore;
}

/**
 * Load an org from validated config: resolve env refs, load capabilities, bootstrap agents.
 * Does not connect to backbone or start workflows.
 */
export function bootstrap(config: OrgConfig): OrgRuntime {
  const resolved = resolveEnv(config);
  const capabilities = loadCapabilities(resolved);
  const agents = bootstrapAgents(resolved, capabilities);
  return {
    config: resolved,
    capabilities,
    agents,
  };
}

/**
 * Create backbone adapter from runtime config, connect, and attach to runtime.
 * For Redis, also creates a checkpoint store (keyspace daof:checkpoint:*).
 * No-op if config.backbone.type is not yet implemented (rabbitmq/kafka throw from createBackbone).
 */
export async function connectBackbone(runtime: OrgRuntime): Promise<void> {
  const adapter = createBackbone(runtime.config.backbone);
  await adapter.connect();
  runtime.backbone = adapter;
  if (runtime.config.backbone.type === "redis") {
    const url = runtime.config.backbone.config.url;
    runtime.checkpointStore = createRedisCheckpointStore(url);
    runtime.capabilityStore = createRedisCapabilityStore(url);
  }
}
