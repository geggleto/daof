import { createAgent } from "./agent.js";
import { isKnownProvider, getKnownProviderIds } from "../providers/registry.js";
/**
 * Build a map of agent id -> Agent from resolved org config and loaded capabilities.
 * Each agent gets only the capabilities it references; missing refs throw.
 * When runtime is provided, agents use the middleware pipeline (agent + capability).
 */
export function bootstrapAgents(config, capabilities, runtime) {
    const map = new Map();
    for (const [id, agentConfig] of Object.entries(config.agents)) {
        if (!isKnownProvider(agentConfig.provider)) {
            throw new Error(`Unknown provider "${agentConfig.provider}" for agent "${id}". Known: ${getKnownProviderIds().join(", ")}.`);
        }
        const agentCaps = new Map();
        for (const ref of agentConfig.capabilities) {
            const instance = capabilities.get(ref.name);
            if (!instance) {
                throw new Error(`Agent "${id}" references capability "${ref.name}" which is not loaded.`);
            }
            agentCaps.set(ref.name, instance);
        }
        map.set(id, createAgent(id, agentConfig.provider, agentConfig.model, agentConfig.role, agentCaps, agentConfig.fallback, agentConfig.max_concurrent_tasks, runtime));
    }
    return map;
}
//# sourceMappingURL=bootstrap.js.map