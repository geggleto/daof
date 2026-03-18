import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import type { Agent } from "./agent.js";
import type { RuntimeWithMiddleware } from "../runtime/middleware.js";
/**
 * Build a map of agent id -> Agent from resolved org config and loaded capabilities.
 * Each agent gets only the capabilities it references; missing refs throw.
 * When runtime is provided, agents use the middleware pipeline (agent + capability).
 */
export declare function bootstrapAgents(config: OrgConfig, capabilities: Map<string, CapabilityInstance>, runtime: RuntimeWithMiddleware): Map<string, Agent>;
//# sourceMappingURL=bootstrap.d.ts.map