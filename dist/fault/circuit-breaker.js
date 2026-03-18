import { CircuitBreaker } from "p-circuit-breaker";
/** Default: open circuit after this many failures (e.g. step or run failures). */
export const DEFAULT_FAILURE_THRESHOLD = 5;
/** Default: max ms per operation before counting as failure (optional). */
export const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * Create an app-level circuit breaker. When it opens (e.g. after 5 failures),
 * execute() throws; the process should then quit gracefully (exit 1).
 */
export function createAppCircuitBreaker(options) {
    const failureThreshold = options?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const windowSize = options?.windowSizeMs ?? 60_000;
    const breaker = new CircuitBreaker({
        failureThresholdCount: failureThreshold,
        timeout,
        windowSize,
    });
    return {
        async execute(fn) {
            const result = await breaker.execute(fn);
            if (result === undefined) {
                throw new Error("Circuit breaker returned undefined");
            }
            return result;
        },
    };
}
//# sourceMappingURL=circuit-breaker.js.map