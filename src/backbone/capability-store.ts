import type { JsonValue } from "../types/json.js";
import { CAPABILITY_KEY_PREFIX } from "./checkpoint-store.js";
import { Redis } from "ioredis";

/**
 * Key-value store for capability data (e.g. KeyValueStore capability).
 * Uses keyspace daof:capability:*; values stored as JSON strings.
 */
export interface CapabilityStore {
  get(key: string): Promise<JsonValue | null>;
  set(key: string, value: JsonValue): Promise<void>;
  delete(key: string): Promise<void>;
}

function capabilityKey(key: string): string {
  return `${CAPABILITY_KEY_PREFIX}${key}`;
}

/**
 * Returns a CapabilityStore that prefixes all keys with capabilityId so each
 * capability's data is isolated (keyspace effectively daof:capability:{capabilityId}:*).
 */
export function createScopedCapabilityStore(
  capabilityId: string,
  underlying: CapabilityStore
): CapabilityStore {
  const prefix = `${capabilityId}:`;
  return {
    async get(key: string): Promise<JsonValue | null> {
      return underlying.get(prefix + key);
    },
    async set(key: string, value: JsonValue): Promise<void> {
      return underlying.set(prefix + key, value);
    },
    async delete(key: string): Promise<void> {
      return underlying.delete(prefix + key);
    },
  };
}

/**
 * Redis-backed capability store using keyspace daof:capability:*.
 * Use the same URL as the backbone or a dedicated Redis instance.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export function createRedisCapabilityStore(redisUrl: string, redisClient?: Redis): CapabilityStore {
  let client: Redis | null = redisClient ?? null;

  async function getClient(): Promise<Redis> {
    if (!client) {
      client = new Redis(redisUrl);
      await client.ping();
    }
    return client;
  }

  return {
    async get(key: string): Promise<JsonValue | null> {
      const c = await getClient();
      const raw = await c.get(capabilityKey(key));
      if (raw === null) return null;
      return JSON.parse(raw) as JsonValue;
    },

    async set(key: string, value: JsonValue): Promise<void> {
      const c = await getClient();
      await c.set(capabilityKey(key), JSON.stringify(value));
    },

    async delete(key: string): Promise<void> {
      const c = await getClient();
      await c.del(capabilityKey(key));
    },
  };
}
