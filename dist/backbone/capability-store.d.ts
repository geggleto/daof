import type { JsonValue } from "../types/json.js";
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
/**
 * Returns a CapabilityStore that prefixes all keys with capabilityId so each
 * capability's data is isolated (keyspace effectively daof:capability:{capabilityId}:*).
 */
export declare function createScopedCapabilityStore(capabilityId: string, underlying: CapabilityStore): CapabilityStore;
/**
 * Redis-backed capability store using keyspace daof:capability:*.
 * Use the same URL as the backbone or a dedicated Redis instance.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export declare function createRedisCapabilityStore(redisUrl: string, redisClient?: Redis): CapabilityStore;
//# sourceMappingURL=capability-store.d.ts.map