import { Redis } from "ioredis";
import { createRedisWorkflowSemaphore } from "./semaphore.js";
import { createRedisRunRegistry } from "./run-registry.js";
import { createRedisCheckpointStore } from "./checkpoint-store.js";
import { createRedisCapabilityStore } from "./capability-store.js";
function serialize(payload) {
    return typeof payload === "string" ? payload : JSON.stringify(payload);
}
function getQueueType(config, queueName) {
    const q = config.config.queues.find((qu) => qu.name === queueName);
    return q?.type ?? "pubsub";
}
/**
 * Redis backbone adapter. Uses PUBLISH/SUBSCRIBE for pubsub queues
 * and LPUSH/BRPOP for fifo queues.
 */
export function createRedisAdapter(config) {
    if (config.type !== "redis") {
        throw new Error("createRedisAdapter requires config.type === 'redis'");
    }
    const url = config.config.url;
    let publisher = null;
    let subscriber = null;
    const unsubscribers = [];
    return {
        async connect() {
            if (publisher)
                return;
            const opts = { maxRetriesPerRequest: 0 };
            publisher = new Redis(url, opts);
            subscriber = new Redis(url, opts);
            publisher.on("error", () => { });
            subscriber.on("error", () => { });
            await Promise.all([
                publisher.ping(),
                subscriber.ping(),
            ]);
        },
        async disconnect() {
            for (const unsub of unsubscribers)
                unsub();
            unsubscribers.length = 0;
            if (subscriber) {
                await subscriber.quit();
                subscriber = null;
            }
            if (publisher) {
                await publisher.quit();
                publisher = null;
            }
        },
        async publish(queueName, payload) {
            if (!publisher)
                throw new Error("Backbone not connected");
            const body = serialize(payload);
            const type = getQueueType(config, queueName);
            if (type === "pubsub") {
                await publisher.publish(queueName, body);
            }
            else {
                await publisher.lpush(queueName, body);
            }
        },
        async subscribe(queueName, handler) {
            if (!subscriber)
                throw new Error("Backbone not connected");
            const type = getQueueType(config, queueName);
            if (type === "pubsub") {
                await subscriber.subscribe(queueName);
                const messageHandler = (ch, msg) => {
                    if (ch === queueName)
                        void Promise.resolve(handler(msg)).catch(() => { });
                };
                subscriber.on("message", messageHandler);
                const unsubscribe = () => {
                    subscriber?.unsubscribe(queueName);
                    subscriber?.off("message", messageHandler);
                };
                unsubscribers.push(unsubscribe);
                return unsubscribe;
            }
            // fifo: blocking pop loop
            let stopped = false;
            const unsubscribe = () => {
                stopped = true;
            };
            unsubscribers.push(unsubscribe);
            const loop = async () => {
                while (!stopped && subscriber) {
                    try {
                        const result = await subscriber.brpop(queueName, 1);
                        if (stopped || !subscriber)
                            break;
                        if (result) {
                            const [, msg] = result;
                            await handler(msg);
                        }
                    }
                    catch {
                        if (stopped)
                            break;
                    }
                }
            };
            void loop();
            return unsubscribe;
        },
        createWorkflowSemaphore(maxConcurrent) {
            return createRedisWorkflowSemaphore(url, maxConcurrent);
        },
        createRunRegistry() {
            return createRedisRunRegistry(url);
        },
        createCheckpointStore() {
            return createRedisCheckpointStore(url);
        },
        createCapabilityStore() {
            return createRedisCapabilityStore(url);
        },
    };
}
//# sourceMappingURL=redis-adapter.js.map