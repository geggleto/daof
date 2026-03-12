import type { CapabilityInstance, CapabilityInput, CapabilityOutput, JsonValue } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import type { CapabilityStore } from "../../backbone/capability-store.js";
import {
  recordAgentStep,
  loadAgentIndex,
  loadAgentMetrics,
  buildAgentReport,
  type AgentReport,
} from "../../runtime/agent-metrics-store.js";
import { registerBundled } from "./registry.js";

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
    async get(key: string) {
      return memoryStore.get(key) ?? null;
    },
    async set(key: string, value: JsonValue) {
      memoryStore.set(key, value);
    },
    async delete(key: string) {
      memoryStore.delete(key);
    },
  };
}

function resolveStore(runContext?: RunContext): CapabilityStore {
  return runContext?.metricsStore ?? runContext?.capabilityStore ?? fallbackStore();
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
 *   Uses the same store as the agent_metrics middleware when runContext.metricsStore is set.
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
          await recordAgentStep(store, agentId, durationMs, success, qualityScore);
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
          const report = buildAgentReport(metrics, lookbackMs);
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
