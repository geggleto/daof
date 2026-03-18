/** Keyspace for workflow checkpoints; capability persistence uses a different keyspace (e.g. daof:capability:*). */
export const CHECKPOINT_KEY_PREFIX = "daof:checkpoint:";
/** Keyspace for capability storage; must not overlap with checkpoints. */
export const CAPABILITY_KEY_PREFIX = "daof:capability:";
function checkpointKey(workflowId, runId, stepIndex) {
    return `${CHECKPOINT_KEY_PREFIX}${workflowId}:${runId}:${stepIndex}`;
}
import { Redis } from "ioredis";
/**
 * Redis-backed checkpoint store using keyspace daof:checkpoint:*.
 * Use a dedicated Redis client or the same URL as the backbone; does not share keys with capability data.
 * When redisClient is provided, it is used instead of creating a new connection (DIP: injectable for tests/shared connection).
 */
export function createRedisCheckpointStore(redisUrl, redisClient) {
    let client = redisClient ?? null;
    async function getClient() {
        if (!client) {
            client = new Redis(redisUrl);
            await client.ping();
        }
        return client;
    }
    return {
        async save(workflowId, runId, stepIndex, context) {
            const c = await getClient();
            const key = checkpointKey(workflowId, runId, stepIndex);
            await c.set(key, JSON.stringify(context));
        },
        async load(workflowId, runId, stepIndex) {
            const c = await getClient();
            const key = checkpointKey(workflowId, runId, stepIndex);
            const raw = await c.get(key);
            if (raw === null)
                return null;
            return JSON.parse(raw);
        },
    };
}
//# sourceMappingURL=checkpoint-store.js.map