import { describe, it, expect, afterEach } from "vitest";
import { createBackbone } from "../src/backbone/factory.js";
import type { BackboneConfig } from "../src/schema/index.js";

const redisConfig: BackboneConfig = {
  type: "redis",
  config: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    queues: [
      { name: "events", type: "pubsub" },
      { name: "dlq", type: "fifo" },
    ],
  },
};

/** Set REDIS_AVAILABLE=1 to run Redis integration tests (e.g. with docker run -p 6379:6379 redis). */
const redisAvailable = process.env.REDIS_AVAILABLE === "1";

describe("Redis backbone adapter", () => {
  const adapter = createBackbone(redisConfig);

  afterEach(async () => {
    await adapter.disconnect();
  });

  it("connects, publishes to pubsub queue, and subscriber receives", async () => {
    if (!redisAvailable) return;
    await adapter.connect();
    const received: string[] = [];
    const unsub = await adapter.subscribe("events", (msg) => {
      received.push(msg);
    });
    await smallDelay(30);
    await adapter.publish("events", { event: "test", id: 1 });
    await smallDelay(100);
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(received[0]!)).toMatchObject({ event: "test", id: 1 });
    unsub();
  }, 10000);

  it("publish with string payload succeeds", async () => {
    if (!redisAvailable) return;
    await adapter.connect();
    await adapter.publish("events", "hello");
    const received: string[] = [];
    const unsub = await adapter.subscribe("events", (msg) => received.push(msg));
    await adapter.publish("events", "world");
    await smallDelay();
    expect(received).toContain("world");
    unsub();
  }, 10000);
});

function smallDelay(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
