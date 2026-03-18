import type { AgentMiddleware } from "./middleware.js";
import type { RuntimeWithMiddleware } from "./middleware.js";
/**
 * Built-in agent middleware that records (agentId, durationMs, success) after each agent invoke.
 * Writes to runtime.metricsStore when present so fetch_agent_performance "report" can read the same data.
 */
export declare function createAgentMetricsMiddleware(_runtime: RuntimeWithMiddleware): AgentMiddleware;
//# sourceMappingURL=agent-metrics-middleware.d.ts.map