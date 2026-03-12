import { Redis } from "ioredis";

const SEMAPHORE_KEY = "daof:semaphore:workflows";

export interface WorkflowSemaphore {
  /** Try to acquire a slot. Returns true if acquired, false if at capacity. */
  acquire(): Promise<boolean>;
  /** Release a slot. Must be called after run completes (e.g. in finally). */
  release(): Promise<void>;
}

const ACQUIRE_SCRIPT = `
  local v = redis.call('GET', KEYS[1]) or '0'
  if tonumber(v) < tonumber(ARGV[1]) then
    return redis.call('INCR', KEYS[1])
  end
  return 0
`;

/**
 * Redis-backed semaphore for limiting concurrent workflow runs.
 * Uses key daof:semaphore:workflows with integer value = in-use count.
 * acquire: atomic Lua script to only INCR if count < max.
 * release: DECR.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export function createRedisWorkflowSemaphore(
  redisUrl: string,
  maxConcurrent: number,
  redisClient?: Redis
): WorkflowSemaphore {
  let client: Redis | null = redisClient ?? null;

  async function getClient(): Promise<Redis> {
    if (!client) {
      client = new Redis(redisUrl);
      await client.ping();
    }
    return client;
  }

  return {
    async acquire(): Promise<boolean> {
      const c = await getClient();
      const result = await c.eval(ACQUIRE_SCRIPT, 1, SEMAPHORE_KEY, String(maxConcurrent));
      return Number(result) > 0;
    },

    async release(): Promise<void> {
      const c = await getClient();
      const count = await c.decr(SEMAPHORE_KEY);
      if (count < 0) {
        await c.set(SEMAPHORE_KEY, "0");
      }
    },
  };
}

/**
 * In-memory semaphore for single-instance use when Redis is unavailable.
 * Not safe across processes.
 */
export function createInMemoryWorkflowSemaphore(
  maxConcurrent: number
): WorkflowSemaphore {
  let inUse = 0;
  return {
    async acquire(): Promise<boolean> {
      if (inUse < maxConcurrent) {
        inUse += 1;
        return true;
      }
      return false;
    },
    async release(): Promise<void> {
      if (inUse > 0) inUse -= 1;
    },
  };
}
