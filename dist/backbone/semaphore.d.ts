import { Redis } from "ioredis";
export interface WorkflowSemaphore {
    /** Try to acquire a slot. Returns true if acquired, false if at capacity. */
    acquire(): Promise<boolean>;
    /** Release a slot. Must be called after run completes (e.g. in finally). */
    release(): Promise<void>;
}
/**
 * Redis-backed semaphore for limiting concurrent workflow runs.
 * Uses key daof:semaphore:workflows with integer value = in-use count.
 * acquire: atomic Lua script to only INCR if count < max.
 * release: DECR.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export declare function createRedisWorkflowSemaphore(redisUrl: string, maxConcurrent: number, redisClient?: Redis): WorkflowSemaphore;
/**
 * In-memory semaphore for single-instance use when Redis is unavailable.
 * Not safe across processes.
 */
export declare function createInMemoryWorkflowSemaphore(maxConcurrent: number): WorkflowSemaphore;
//# sourceMappingURL=semaphore.d.ts.map