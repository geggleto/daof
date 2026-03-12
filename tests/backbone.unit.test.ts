import { describe, it, expect } from "vitest";
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

describe("backbone factory", () => {
  it("returns adapter for type redis", () => {
    const adapter = createBackbone(redisConfig);
    expect(adapter).toHaveProperty("connect");
    expect(adapter).toHaveProperty("disconnect");
    expect(adapter).toHaveProperty("publish");
    expect(adapter).toHaveProperty("subscribe");
  });

  it("throws for type rabbitmq", () => {
    expect(() =>
      createBackbone({ ...redisConfig, type: "rabbitmq" })
    ).toThrow("Unknown backbone type: rabbitmq");
  });

  it("throws for type kafka", () => {
    expect(() =>
      createBackbone({ ...redisConfig, type: "kafka" })
    ).toThrow("Unknown backbone type: kafka");
  });
});
