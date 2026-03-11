import type { WorkflowContext } from "../workflow/types.js";

/** Keyspace for workflow checkpoints; capability persistence uses a different keyspace (e.g. daof:capability:*). */
export const CHECKPOINT_KEY_PREFIX = "daof:checkpoint:";

/** Keyspace for capability storage; must not overlap with checkpoints. */
export const CAPABILITY_KEY_PREFIX = "daof:capability:";

/**
 * Store and load workflow checkpoints at step boundaries.
 * Implementations use a separate keyspace from capability persistence.
 */
export interface CheckpointStore {
  save(
    workflowId: string,
    runId: string,
    stepIndex: number,
    context: WorkflowContext
  ): Promise<void>;

  load(
    workflowId: string,
    runId: string,
    stepIndex: number
  ): Promise<WorkflowContext | null>;
}

function checkpointKey(workflowId: string, runId: string, stepIndex: number): string {
  return `${CHECKPOINT_KEY_PREFIX}${workflowId}:${runId}:${stepIndex}`;
}

import { Redis } from "ioredis";

/**
 * Redis-backed checkpoint store using keyspace daof:checkpoint:*.
 * Use a dedicated Redis client or the same URL as the backbone; does not share keys with capability data.
 */
export function createRedisCheckpointStore(redisUrl: string): CheckpointStore {
  let client: Redis | null = null;

  async function getClient(): Promise<Redis> {
    if (!client) {
      client = new Redis(redisUrl);
      await client.ping();
    }
    return client;
  }

  return {
    async save(
      workflowId: string,
      runId: string,
      stepIndex: number,
      context: WorkflowContext
    ): Promise<void> {
      const c = await getClient();
      const key = checkpointKey(workflowId, runId, stepIndex);
      await c.set(key, JSON.stringify(context));
    },

    async load(
      workflowId: string,
      runId: string,
      stepIndex: number
    ): Promise<WorkflowContext | null> {
      const c = await getClient();
      const key = checkpointKey(workflowId, runId, stepIndex);
      const raw = await c.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as WorkflowContext;
    },
  };
}
