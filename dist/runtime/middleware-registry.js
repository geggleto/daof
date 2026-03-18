import { createAgentMetricsMiddleware } from "./agent-metrics-middleware.js";
const agentRegistry = new Map();
const capabilityRegistry = new Map();
function registerBuiltInAgentMiddlewares() {
    if (!agentRegistry.has("agent_metrics")) {
        agentRegistry.set("agent_metrics", createAgentMetricsMiddleware);
    }
}
registerBuiltInAgentMiddlewares();
export function registerAgentMiddleware(name, factory) {
    agentRegistry.set(name, factory);
}
export function registerCapabilityMiddleware(name, factory) {
    capabilityRegistry.set(name, factory);
}
export function getKnownAgentMiddlewareNames() {
    return Array.from(agentRegistry.keys());
}
export function getKnownCapabilityMiddlewareNames() {
    return Array.from(capabilityRegistry.keys());
}
/**
 * Resolve agent middleware names to middleware instances. Unknown names throw.
 */
export function resolveAgentMiddlewares(names, runtime) {
    const out = [];
    for (const name of names) {
        const factory = agentRegistry.get(name);
        if (!factory) {
            throw new Error(`Unknown agent middleware: ${name}. Known: ${getKnownAgentMiddlewareNames().join(", ")}.`);
        }
        out.push(factory(runtime));
    }
    return out;
}
/**
 * Resolve capability middleware names to middleware instances. Unknown names throw.
 */
export function resolveCapabilityMiddlewares(names, runtime) {
    const out = [];
    for (const name of names) {
        const factory = capabilityRegistry.get(name);
        if (!factory) {
            throw new Error(`Unknown capability middleware: ${name}. Known: ${getKnownCapabilityMiddlewareNames().join(", ")}.`);
        }
        out.push(factory(runtime));
    }
    return out;
}
//# sourceMappingURL=middleware-registry.js.map