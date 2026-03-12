import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import type { Agent } from "./agent.js";
import type { RuntimeWithMiddleware } from "../runtime/middleware.js";
import { createAgent } from "./agent.js";
import { isKnownProvider, getKnownProviderIds } from "../providers/registry.js";

/**
 * Build a map of agent id -> Agent from resolved org config and loaded capabilities.
 * Each agent gets only the capabilities it references; missing refs throw.
 * When runtime is provided, agents use the middleware pipeline (agent + capability).
 */
export function bootstrapAgents(
  config: OrgConfig,
  capabilities: Map<string, CapabilityInstance>,
  runtime: RuntimeWithMiddleware
): Map<string, Agent> {
  const map = new Map<string, Agent>();
  for (const [id, agentConfig] of Object.entries(config.agents)) {
    if (!isKnownProvider(agentConfig.provider)) {
      throw new Error(
        `Unknown provider "${agentConfig.provider}" for agent "${id}". Known: ${getKnownProviderIds().join(", ")}.`
      );
    }
    const agentCaps = new Map<string, CapabilityInstance>();
    for (const ref of agentConfig.capabilities) {
      const instance = capabilities.get(ref.name);
      if (!instance) {
        throw new Error(
          `Agent "${id}" references capability "${ref.name}" which is not loaded.`
        );
      }
      agentCaps.set(ref.name, instance);
    }
    map.set(
      id,
      createAgent(
        id,
        agentConfig.provider,
        agentConfig.model,
        agentConfig.role,
        agentCaps,
        agentConfig.fallback,
        agentConfig.max_concurrent_tasks,
        runtime
      )
    );
  }
  return map;
}
