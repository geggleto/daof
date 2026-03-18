import { CAPABILITY_KEY_PREFIX } from "./checkpoint-store.js";
import { Redis } from "ioredis";
function capabilityKey(key) {
    return `${CAPABILITY_KEY_PREFIX}${key}`;
}
/**
 * Returns a CapabilityStore that prefixes all keys with capabilityId so each
 * capability's data is isolated (keyspace effectively daof:capability:{capabilityId}:*).
 */
export function createScopedCapabilityStore(capabilityId, underlying) {
    const prefix = `${capabilityId}:`;
    return {
        async get(key) {
            return underlying.get(prefix + key);
        },
        async set(key, value) {
            return underlying.set(prefix + key, value);
        },
        async delete(key) {
            return underlying.delete(prefix + key);
        },
    };
}
/**
 * Redis-backed capability store using keyspace daof:capability:*.
 * Use the same URL as the backbone or a dedicated Redis instance.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export function createRedisCapabilityStore(redisUrl, redisClient) {
    let client = redisClient ?? null;
    async function getClient() {
        if (!client) {
            client = new Redis(redisUrl);
            await client.ping();
        }
        return client;
    }
    return {
        async get(key) {
            const c = await getClient();
            const raw = await c.get(capabilityKey(key));
            if (raw === null)
                return null;
            return JSON.parse(raw);
        },
        async set(key, value) {
            const c = await getClient();
            await c.set(capabilityKey(key), JSON.stringify(value));
        },
        async delete(key) {
            const c = await getClient();
            await c.del(capabilityKey(key));
        },
    };
}
//# sourceMappingURL=capability-store.js.map