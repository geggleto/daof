export const METRICS_INDEX_KEY = "agent_ids";
export const QUALITY_SCORES_LIMIT = 10;
function agentMetricsKey(agentId) {
    return `metrics:${agentId}`;
}
export async function loadAgentIndex(store) {
    const raw = await store.get(METRICS_INDEX_KEY);
    if (Array.isArray(raw))
        return raw.filter((v) => typeof v === "string");
    return [];
}
async function saveAgentIndex(store, ids) {
    await store.set(METRICS_INDEX_KEY, ids);
}
export async function loadAgentMetrics(store, agentId) {
    const raw = await store.get(agentMetricsKey(agentId));
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const obj = raw;
        const records = Array.isArray(obj.records) ? obj.records : [];
        return { agentId, records };
    }
    return { agentId, records: [] };
}
async function saveAgentMetrics(store, metrics) {
    await store.set(agentMetricsKey(metrics.agentId), {
        agentId: metrics.agentId,
        records: metrics.records,
    });
}
/**
 * Record a single step outcome for an agent. Shared by fetch_agent_performance
 * capability and the built-in agent_metrics middleware.
 */
export async function recordAgentStep(store, agentId, durationMs, success, qualityScore) {
    const index = await loadAgentIndex(store);
    if (!index.includes(agentId)) {
        index.push(agentId);
        await saveAgentIndex(store, index);
    }
    const metrics = await loadAgentMetrics(store, agentId);
    const record = {
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
export function buildAgentReport(metrics, lookbackMs) {
    const cutoff = Date.now() - lookbackMs;
    const recent = metrics.records.filter((r) => r.timestamp >= cutoff);
    const total = recent.length;
    const failures = recent.filter((r) => !r.success).length;
    const completions = total - failures;
    const avgDuration = total > 0
        ? Math.round(recent.reduce((sum, r) => sum + r.durationMs, 0) / total)
        : 0;
    const errorRate = total > 0 ? parseFloat((failures / total).toFixed(4)) : 0;
    const qualityScores = recent
        .filter((r) => r.qualityScore !== undefined)
        .map((r) => r.qualityScore)
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
//# sourceMappingURL=agent-metrics-store.js.map