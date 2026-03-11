import { Redis } from "ioredis";
import type { BackboneAdapter, BackbonePayload } from "./types.js";
import type { BackboneConfig } from "../schema/index.js";
import { createRedisWorkflowSemaphore } from "./semaphore.js";
import { createRedisRunRegistry } from "./run-registry.js";
import { createRedisCheckpointStore } from "./checkpoint-store.js";
import { createRedisCapabilityStore } from "./capability-store.js";

function serialize(payload: BackbonePayload): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

function getQueueType(config: BackboneConfig, queueName: string): "pubsub" | "fifo" {
  const q = config.config.queues.find((qu) => qu.name === queueName);
  return q?.type ?? "pubsub";
}

/**
 * Redis backbone adapter. Uses PUBLISH/SUBSCRIBE for pubsub queues
 * and LPUSH/BRPOP for fifo queues.
 */
export function createRedisAdapter(config: BackboneConfig): BackboneAdapter {
  if (config.type !== "redis") {
    throw new Error("createRedisAdapter requires config.type === 'redis'");
  }
  const url = config.config.url;
  let publisher: Redis | null = null;
  let subscriber: Redis | null = null;
  const unsubscribers: Array<() => void> = [];

  return {
    async connect(): Promise<void> {
      if (publisher) return;
      const opts = { maxRetriesPerRequest: 0 };
      publisher = new Redis(url, opts);
      subscriber = new Redis(url, opts);
      publisher.on("error", () => {});
      subscriber.on("error", () => {});
      await Promise.all([
        publisher.ping(),
        subscriber.ping(),
      ]);
    },

    async disconnect(): Promise<void> {
      for (const unsub of unsubscribers) unsub();
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

    async publish(queueName: string, payload: BackbonePayload): Promise<void> {
      if (!publisher) throw new Error("Backbone not connected");
      const body = serialize(payload);
      const type = getQueueType(config, queueName);
      if (type === "pubsub") {
        await publisher.publish(queueName, body);
      } else {
        await publisher.lpush(queueName, body);
      }
    },

    async subscribe(
      queueName: string,
      handler: (payload: string) => void | Promise<void>
    ): Promise<() => void> {
      if (!subscriber) throw new Error("Backbone not connected");
      const type = getQueueType(config, queueName);

      if (type === "pubsub") {
        await subscriber.subscribe(queueName);
        const messageHandler = (ch: string, msg: string) => {
          if (ch === queueName) void Promise.resolve(handler(msg)).catch(() => {});
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
            if (stopped || !subscriber) break;
            if (result) {
              const [, msg] = result;
              await handler(msg);
            }
          } catch {
            if (stopped) break;
          }
        }
      };
      void loop();
      return unsubscribe;
    },

    createWorkflowSemaphore(maxConcurrent: number) {
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
