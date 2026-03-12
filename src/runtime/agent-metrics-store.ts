import type { JsonValue } from "../types/json.js";
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

export const METRICS_INDEX_KEY = "agent_ids";
export const QUALITY_SCORES_LIMIT = 10;

function agentMetricsKey(agentId: string): string {
  return `metrics:${agentId}`;
}

export async function loadAgentIndex(store: CapabilityStore): Promise<string[]> {
  const raw = await store.get(METRICS_INDEX_KEY);
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return [];
}

async function saveAgentIndex(store: CapabilityStore, ids: string[]): Promise<void> {
  await store.set(METRICS_INDEX_KEY, ids);
}

export async function loadAgentMetrics(store: CapabilityStore, agentId: string): Promise<AgentMetrics> {
  const raw = await store.get(agentMetricsKey(agentId));
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, JsonValue>;
    const records = Array.isArray(obj.records) ? (obj.records as unknown as StepRecord[]) : [];
    return { agentId, records };
  }
  return { agentId, records: [] };
}

async function saveAgentMetrics(store: CapabilityStore, metrics: AgentMetrics): Promise<void> {
  await store.set(agentMetricsKey(metrics.agentId), {
    agentId: metrics.agentId,
    records: metrics.records as unknown as JsonValue[],
  });
}

/**
 * Record a single step outcome for an agent. Shared by fetch_agent_performance
 * capability and the built-in agent_metrics middleware.
 */
export async function recordAgentStep(
  store: CapabilityStore,
  agentId: string,
  durationMs: number,
  success: boolean,
  qualityScore?: number
): Promise<void> {
  const index = await loadAgentIndex(store);
  if (!index.includes(agentId)) {
    index.push(agentId);
    await saveAgentIndex(store, index);
  }

  const metrics = await loadAgentMetrics(store, agentId);
  const record: StepRecord = {
    timestamp: Date.now(),
    durationMs,
    success,
    ...(qualityScore !== undefined && { qualityScore }),
  };
  metrics.records.push(record);
  await saveAgentMetrics(store, metrics);
}

/**
 * Build a report for one agent over a lookback window. Used by fetch_agent_performance.
 */
export function buildAgentReport(metrics: AgentMetrics, lookbackMs: number): AgentReport {
  const cutoff = Date.now() - lookbackMs;
  const recent = metrics.records.filter((r) => r.timestamp >= cutoff);

  const total = recent.length;
  const failures = recent.filter((r) => !r.success).length;
  const completions = total - failures;
  const avgDuration =
    total > 0
      ? Math.round(recent.reduce((sum, r) => sum + r.durationMs, 0) / total)
      : 0;
  const errorRate = total > 0 ? parseFloat((failures / total).toFixed(4)) : 0;

  const qualityScores = recent
    .filter((r) => r.qualityScore !== undefined)
    .map((r) => r.qualityScore!)
    .slice(-QUALITY_SCORES_LIMIT);

  return {
    agent_id: metrics.agentId,
    task_completions: completions,
    failure_count: failures,
    avg_step_duration_ms: avgDuration,
    error_rate: errorRate,
    last_quality_scores: qualityScores,
  };
}
