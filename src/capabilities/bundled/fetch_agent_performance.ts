import type { CapabilityInstance, CapabilityInput, CapabilityOutput, JsonValue } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import type { CapabilityStore } from "../../backbone/capability-store.js";
import { registerBundled } from "./registry.js";

interface StepRecord {
  timestamp: number;
  durationMs: number;
  success: boolean;
  qualityScore?: number;
}

interface AgentMetrics {
  agentId: string;
  records: StepRecord[];
}

interface AgentReport {
  agent_id: string;
  task_completions: number;
  failure_count: number;
  avg_step_duration_ms: number;
  error_rate: number;
  last_quality_scores: number[];
}

const METRICS_INDEX_KEY = "agent_ids";
const QUALITY_SCORES_LIMIT = 10;

function agentMetricsKey(agentId: string): string {
  return `metrics:${agentId}`;
}

function getConfigArray(def: CapabilityDefinition, key: string): string[] {
  const c = def.config;
  if (c && typeof c === "object" && key in c) {
    const val = (c as Record<string, unknown>)[key];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
  }
  return [];
}

function getConfigNumber(def: CapabilityDefinition, key: string, fallback: number): number {
  const c = def.config;
  if (c && typeof c === "object" && key in c) {
    const val = (c as Record<string, unknown>)[key];
    if (typeof val === "number") return val;
  }
  return fallback;
}

const memoryStore = new Map<string, JsonValue>();

function fallbackStore(): CapabilityStore {
  return {
    async get(key: string) { return memoryStore.get(key) ?? null; },
    async set(key: string, value: JsonValue) { memoryStore.set(key, value); },
    async delete(key: string) { memoryStore.delete(key); },
  };
}

function resolveStore(runContext?: RunContext): CapabilityStore {
  return runContext?.capabilityStore ?? fallbackStore();
}

async function loadAgentIndex(store: CapabilityStore): Promise<string[]> {
  const raw = await store.get(METRICS_INDEX_KEY);
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return [];
}

async function saveAgentIndex(store: CapabilityStore, ids: string[]): Promise<void> {
  await store.set(METRICS_INDEX_KEY, ids);
}

async function loadAgentMetrics(store: CapabilityStore, agentId: string): Promise<AgentMetrics> {
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

async function recordStep(
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

function buildReport(
  metrics: AgentMetrics,
  lookbackMs: number
): AgentReport {
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

/**
 * Bundled fetch_agent_performance capability.
 *
 * action "record": Input: { agent_id, duration_ms, success, quality_score? }
 *   Persists a step outcome for the given agent.
 *
 * action "report" (default): Input: { exclude?, lookback_days? }
 *   Returns { agents: AgentReport[] } with per-agent performance stats
 *   filtered by the exclude list and lookback window.
 */
export function createFetchAgentPerformanceInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const defaultExclude = getConfigArray(def, "default_exclude");
  const defaultLookbackDays = getConfigNumber(def, "lookback_days", 7);

  return {
    async execute(input: CapabilityInput, runContext?: RunContext): Promise<CapabilityOutput> {
      const store = resolveStore(runContext);
      const action = typeof input.action === "string" ? input.action : "report";

      if (action === "record") {
        const agentId = typeof input.agent_id === "string" ? input.agent_id : "";
        if (!agentId) return { ok: false, error: "Missing agent_id" };

        const durationMs = typeof input.duration_ms === "number" ? input.duration_ms : 0;
        const success = typeof input.success === "boolean" ? input.success : true;
        const qualityScore = typeof input.quality_score === "number" ? input.quality_score : undefined;

        try {
          await recordStep(store, agentId, durationMs, success, qualityScore);
          return { ok: true };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          return { ok: false, error };
        }
      }

      // "report" mode
      const excludeInput = Array.isArray(input.exclude)
        ? input.exclude.filter((v): v is string => typeof v === "string")
        : null;
      const exclude = new Set(excludeInput ?? defaultExclude);

      const lookbackDays =
        typeof input.lookback_days === "number" ? input.lookback_days : defaultLookbackDays;
      const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;

      try {
        const agentIds = await loadAgentIndex(store);
        const reports: AgentReport[] = [];

        for (const id of agentIds) {
          if (exclude.has(id)) continue;
          const metrics = await loadAgentMetrics(store, id);
          const report = buildReport(metrics, lookbackMs);
          if (report.task_completions > 0 || report.failure_count > 0) {
            reports.push(report);
          }
        }

        return { ok: true, agents: reports as unknown as JsonValue[] };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
registerBundled("fetch_agent_performance", createFetchAgentPerformanceInstance);