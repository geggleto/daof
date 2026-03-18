import { Redis } from "ioredis";
export interface RunRegistry {
    /** Register an active run. Call when starting a workflow run. */
    register(runId: string): Promise<void>;
    /** Unregister a run. Call when the run ends or is cancelled. */
    unregister(runId: string): Promise<void>;
    /** Check if cancellation was requested for this run. Call between steps. */
    isCancelled(runId: string): Promise<boolean>;
}
export interface RunRegistryCancel {
    /** Request cancellation of a run. daof kill <run_id> calls this. */
    requestCancel(runId: string): Promise<void>;
}
/**
 * Redis-backed run registry for tracking active workflow runs and cancellation.
 * Keys: daof:run:<run_id> = "1", daof:run:<run_id>:cancel = "1" when kill requested.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export declare function createRedisRunRegistry(redisUrl: string, redisClient?: Redis): RunRegistry & RunRegistryCancel;
//# sourceMappingURL=run-registry.d.ts.map