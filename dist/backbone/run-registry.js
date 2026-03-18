import { Redis } from "ioredis";
const RUN_KEY_PREFIX = "daof:run:";
const CANCEL_SUFFIX = ":cancel";
function runKey(runId) {
    return `${RUN_KEY_PREFIX}${runId}`;
}
function cancelKey(runId) {
    return `${RUN_KEY_PREFIX}${runId}${CANCEL_SUFFIX}`;
}
/**
 * Redis-backed run registry for tracking active workflow runs and cancellation.
 * Keys: daof:run:<run_id> = "1", daof:run:<run_id>:cancel = "1" when kill requested.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export function createRedisRunRegistry(redisUrl, redisClient) {
    let client = redisClient ?? null;
    async function getClient() {
        if (!client) {
            client = new Redis(redisUrl);
            await client.ping();
        }
        return client;
    }
    return {
        async register(runId) {
            const c = await getClient();
            await c.set(runKey(runId), "1");
        },
        async unregister(runId) {
            const c = await getClient();
            await c.del(runKey(runId));
            await c.del(cancelKey(runId));
        },
        async isCancelled(runId) {
            const c = await getClient();
            const v = await c.get(cancelKey(runId));
            return v === "1";
        },
        async requestCancel(runId) {
            const c = await getClient();
            await c.set(cancelKey(runId), "1");
        },
    };
}
//# sourceMappingURL=run-registry.js.map