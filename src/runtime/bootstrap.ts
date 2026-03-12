import type { OrgConfig } from "../schema/index.js";
import type { Agent } from "../agents/agent.js";
import type { CapabilityInstance } from "../types/json.js";
import type { BackboneAdapter } from "../backbone/types.js";
import type { CheckpointStore } from "../backbone/checkpoint-store.js";
import type { CapabilityStore } from "../backbone/capability-store.js";
import type { AgentMiddleware, CapabilityMiddleware } from "./middleware.js";
export type { RunContext } from "./run-context.js";
import { resolveEnv } from "../config/resolve-env.js";
import { loadCapabilities } from "../capabilities/load.js";
import { bootstrapAgents } from "../agents/bootstrap.js";
import { createBackbone } from "../backbone/factory.js";
import { resolveAgentMiddlewares, resolveCapabilityMiddlewares } from "./middleware-registry.js";
import { createScopedCapabilityStore } from "../backbone/capability-store.js";

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
  /** Scoped store for agent metrics (agent_metrics middleware and fetch_agent_performance). Set in connectBackbone when capabilityStore exists. */
  metricsStore?: CapabilityStore;
  /** Agent middleware pipeline (from config.middleware.agent). */
  agentMiddleware?: AgentMiddleware[];
  /** Capability middleware pipeline (from config.middleware.capability). */
  capabilityMiddleware?: CapabilityMiddleware[];
}

/**
 * Load an org from validated config: resolve env refs, load capabilities, resolve middleware, bootstrap agents.
 * Does not connect to backbone or start workflows.
 */
export async function bootstrap(config: OrgConfig): Promise<OrgRuntime> {
  const resolved = resolveEnv(config);
  const capabilities = await loadCapabilities(resolved);
  const runtime: OrgRuntime = {
    config: resolved,
    capabilities,
    agents: new Map(),
  };
  const agentNames = resolved.middleware?.agent ?? [];
  const capabilityNames = resolved.middleware?.capability ?? [];
  if (agentNames.length > 0) {
    runtime.agentMiddleware = resolveAgentMiddlewares(agentNames, runtime);
  }
  if (capabilityNames.length > 0) {
    runtime.capabilityMiddleware = resolveCapabilityMiddlewares(capabilityNames, runtime);
  }
  const agents = bootstrapAgents(resolved, capabilities, runtime);
  runtime.agents = agents;
  return runtime;
}

/**
 * Create backbone adapter from runtime config, connect, and attach to runtime.
 * When the adapter exposes createCheckpointStore/createCapabilityStore (e.g. Redis), attaches those to runtime.
 */
export async function connectBackbone(runtime: OrgRuntime): Promise<void> {
  const adapter = createBackbone(runtime.config.backbone);
  await adapter.connect();
  runtime.backbone = adapter;
  if (adapter.createCheckpointStore) {
    runtime.checkpointStore = adapter.createCheckpointStore();
  }
  if (adapter.createCapabilityStore) {
    runtime.capabilityStore = adapter.createCapabilityStore();
    runtime.metricsStore = createScopedCapabilityStore("agent_metrics", runtime.capabilityStore);
  }
}
