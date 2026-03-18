import type { WorkflowContext } from "../workflow/types.js";
/** Keyspace for workflow checkpoints; capability persistence uses a different keyspace (e.g. daof:capability:*). */
export declare const CHECKPOINT_KEY_PREFIX = "daof:checkpoint:";
/** Keyspace for capability storage; must not overlap with checkpoints. */
export declare const CAPABILITY_KEY_PREFIX = "daof:capability:";
/**
 * Store and load workflow checkpoints at step boundaries.
 * Implementations use a separate keyspace from capability persistence.
 */
export interface CheckpointStore {
    save(workflowId: string, runId: string, stepIndex: number, context: WorkflowContext): Promise<void>;
    load(workflowId: string, runId: string, stepIndex: number): Promise<WorkflowContext | null>;
}
import { Redis } from "ioredis";
/**
 * Redis-backed checkpoint store using keyspace daof:checkpoint:*.
 * Use a dedicated Redis client or the same URL as the backbone; does not share keys with capability data.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export declare function createRedisCheckpointStore(redisUrl: string, redisClient?: Redis): CheckpointStore;
//# sourceMappingURL=checkpoint-store.d.ts.map