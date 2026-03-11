import { Redis } from "ioredis";

const RUN_KEY_PREFIX = "daof:run:";
const CANCEL_SUFFIX = ":cancel";

function runKey(runId: string): string {
  return `${RUN_KEY_PREFIX}${runId}`;
}

function cancelKey(runId: string): string {
  return `${RUN_KEY_PREFIX}${runId}${CANCEL_SUFFIX}`;
}

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
 */
export function createRedisRunRegistry(redisUrl: string): RunRegistry & RunRegistryCancel {
  let client: Redis | null = null;

  async function getClient(): Promise<Redis> {
    if (!client) {
      client = new Redis(redisUrl);
      await client.ping();
    }
    return client;
  }

  return {
    async register(runId: string): Promise<void> {
      const c = await getClient();
      await c.set(runKey(runId), "1");
    },

    async unregister(runId: string): Promise<void> {
      const c = await getClient();
      await c.del(runKey(runId));
      await c.del(cancelKey(runId));
    },

    async isCancelled(runId: string): Promise<boolean> {
      const c = await getClient();
      const v = await c.get(cancelKey(runId));
      return v === "1";
    },

    async requestCancel(runId: string): Promise<void> {
      const c = await getClient();
      await c.set(cancelKey(runId), "1");
    },
  };
}
