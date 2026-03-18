import { dirname } from "node:path";
import { resolveEnv } from "../config/resolve-env.js";
import { loadCapabilities } from "../capabilities/load.js";
import { bootstrapAgents } from "../agents/bootstrap.js";
import { createBackbone } from "../backbone/factory.js";
import { resolveAgentMiddlewares, resolveCapabilityMiddlewares } from "./middleware-registry.js";
import { createScopedCapabilityStore } from "../backbone/capability-store.js";
import { createRegistryStore, getRegistryMongoUri } from "../registry/registry-store.js";
import { createTicketStore } from "../tickets/index.js";
/**
 * Load an org from validated config: resolve env refs, load capabilities, resolve middleware, bootstrap agents.
 * Does not connect to backbone or start workflows.
 */
export async function bootstrap(config, options) {
    const resolved = resolveEnv(config);
    const allowedSourceRoot = options?.orgFilePath ? dirname(options.orgFilePath) : undefined;
    const capabilities = await loadCapabilities(resolved, {
        allowedSourceRoot,
    });
    const runtime = {
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
export async function connectBackbone(runtime) {
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
//# sourceMappingURL=bootstrap.js.map