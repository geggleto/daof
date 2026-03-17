import { dirname } from "node:path";
import type { OrgConfig } from "../schema/index.js";
import type { Agent } from "../agents/agent.js";
import type { CapabilityInstance } from "../types/json.js";
import type { BackboneAdapter } from "../backbone/types.js";
import type { CheckpointStore } from "../backbone/checkpoint-store.js";
import type { CapabilityStore } from "../backbone/capability-store.js";
import type { RegistryStore } from "../registry/registry-store.js";
import type { TicketStore } from "../tickets/index.js";
import type { AgentMiddleware, CapabilityMiddleware } from "./middleware.js";
export type { RunContext } from "./run-context.js";
import { resolveEnv } from "../config/resolve-env.js";
import { loadCapabilities } from "../capabilities/load.js";
import { bootstrapAgents } from "../agents/bootstrap.js";
import { createBackbone } from "../backbone/factory.js";
import { resolveAgentMiddlewares, resolveCapabilityMiddlewares } from "./middleware-registry.js";
import { createScopedCapabilityStore } from "../backbone/capability-store.js";
import { createRegistryStore, getRegistryMongoUri } from "../registry/registry-store.js";
import { createTicketStore } from "../tickets/index.js";

export interface OrgRuntime {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  agents: Map<string, Agent>;
  /** When set, this process is the long-running daemon; sync config to this path on shutdown. */
  orgFilePath?: string;
  /** Set when backbone is connected (e.g. via connectBackbone). */
  backbone?: BackboneAdapter;
  /** Set when backbone is Redis (uses keyspace daof:checkpoint:*). */
  checkpointStore?: CheckpointStore;
  /** Set when backbone is Redis (uses keyspace daof:capability:*). */
  capabilityStore?: CapabilityStore;
  /** Scoped store for agent metrics (agent_metrics middleware and fetch_agent_performance). Set in connectBackbone when capabilityStore exists. */
  metricsStore?: CapabilityStore;
  /** Skills/capabilities registry (MongoDB). Required for running workflows. */
  registry?: RegistryStore;
  /** Ticket store (MongoDB) for run observability. Required for running workflows. */
  ticketStore?: TicketStore;
  /** Agent middleware pipeline (from config.middleware.agent). */
  agentMiddleware?: AgentMiddleware[];
  /** Capability middleware pipeline (from config.middleware.capability). */
  capabilityMiddleware?: CapabilityMiddleware[];
}

export interface BootstrapOptions {
  /** When set, capability source paths are restricted to this file's directory and runtime.orgFilePath is set. */
  orgFilePath?: string;
}

/**
 * Load an org from validated config: resolve env refs, load capabilities, resolve middleware, bootstrap agents.
 * Does not connect to backbone or start workflows.
 */
export async function bootstrap(
  config: OrgConfig,
  options?: BootstrapOptions
): Promise<OrgRuntime> {
  const resolved = resolveEnv(config);
  const allowedSourceRoot = options?.orgFilePath ? dirname(options.orgFilePath) : undefined;
  const capabilities = await loadCapabilities(resolved, {
    allowedSourceRoot,
  });
  const runtime: OrgRuntime = {
    config: resolved,
    capabilities,
    agents: new Map(),
    ...(options?.orgFilePath && { orgFilePath: options.orgFilePath }),
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

  const mongoUri = getRegistryMongoUri(resolved.registry?.mongo_uri);
  runtime.registry = await createRegistryStore(mongoUri);
  runtime.ticketStore = await createTicketStore(mongoUri);

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
