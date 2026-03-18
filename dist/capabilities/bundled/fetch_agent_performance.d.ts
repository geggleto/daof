import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled fetch_agent_performance capability.
 *
 * action "record": Input: { agent_id, duration_ms, success, quality_score? }
 *   Persists a step outcome for the given agent.
 *
 * action "report" (default): Input: { exclude?, lookback_days? }
 *   Returns { agents: AgentReport[] } with per-agent performance stats
 *   filtered by the exclude list and lookback window.
 *   Uses the same store as the agent_metrics middleware when runContext.metricsStore is set.
 */
export declare function createFetchAgentPerformanceInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=fetch_agent_performance.d.ts.map