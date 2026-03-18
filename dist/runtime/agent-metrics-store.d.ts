import type { CapabilityStore } from "../backbone/capability-store.js";
export interface StepRecord {
    timestamp: number;
    durationMs: number;
    success: boolean;
    qualityScore?: number;
}
export interface AgentMetrics {
    agentId: string;
    records: StepRecord[];
}
export interface AgentReport {
    agent_id: string;
    task_completions: number;
    failure_count: number;
    avg_step_duration_ms: number;
    error_rate: number;
    last_quality_scores: number[];
}
export declare const METRICS_INDEX_KEY = "agent_ids";
export declare const QUALITY_SCORES_LIMIT = 10;
export declare function loadAgentIndex(store: CapabilityStore): Promise<string[]>;
export declare function loadAgentMetrics(store: CapabilityStore, agentId: string): Promise<AgentMetrics>;
/**
 * Record a single step outcome for an agent. Shared by fetch_agent_performance
 * capability and the built-in agent_metrics middleware.
 */
export declare function recordAgentStep(store: CapabilityStore, agentId: string, durationMs: number, success: boolean, qualityScore?: number): Promise<void>;
/**
 * Build a report for one agent over a lookback window. Used by fetch_agent_performance.
 */
export declare function buildAgentReport(metrics: AgentMetrics, lookbackMs: number): AgentReport;
//# sourceMappingURL=agent-metrics-store.d.ts.map