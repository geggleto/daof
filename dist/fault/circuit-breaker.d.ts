/**
 * App-level circuit breaker abstraction. Callers depend on this interface
 * so the implementation can be swapped or mocked (e.g. in tests).
 */
export interface AppCircuitBreaker {
    execute<T>(fn: () => Promise<T>): Promise<T>;
}
/** Default: open circuit after this many failures (e.g. step or run failures). */
export declare const DEFAULT_FAILURE_THRESHOLD = 5;
/** Default: max ms per operation before counting as failure (optional). */
export declare const DEFAULT_TIMEOUT_MS = 30000;
/**
 * Create an app-level circuit breaker. When it opens (e.g. after 5 failures),
 * execute() throws; the process should then quit gracefully (exit 1).
 */
export declare function createAppCircuitBreaker(options?: {
    failureThreshold?: number;
    timeoutMs?: number;
    windowSizeMs?: number;
}): AppCircuitBreaker;
//# sourceMappingURL=circuit-breaker.d.ts.map