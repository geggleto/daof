import { recordAgentStep } from "./agent-metrics-store.js";
/**
 * Built-in agent middleware that records (agentId, durationMs, success) after each agent invoke.
 * Writes to runtime.metricsStore when present so fetch_agent_performance "report" can read the same data.
 */
export function createAgentMetricsMiddleware(_runtime) {
    return async (ctx, next) => {
        const start = Date.now();
        let success = true;
        let result;
        try {
            result = await next();
            if (result && typeof result === "object" && "ok" in result && result.ok === false) {
                success = false;
            }
        }
        catch (err) {
            success = false;
            try {
                const store = ctx.runtime.metricsStore ?? ctx.runtime.capabilityStore;
                if (store) {
                    await recordAgentStep(store, ctx.agentId, Date.now() - start, success);
                }
            }
            catch {
                // Ignore metrics recording failure
            }
            throw err;
        }
        try {
            const store = ctx.runtime.metricsStore ?? ctx.runtime.capabilityStore;
            if (store) {
                await recordAgentStep(store, ctx.agentId, Date.now() - start, success);
            }
        }
        catch {
            // Do not fail the step if metrics recording fails
        }
        return result;
    };
}
//# sourceMappingURL=agent-metrics-middleware.js.map