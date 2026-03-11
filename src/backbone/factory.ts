import type { BackboneConfig } from "../schema/index.js";
import type { BackboneAdapter } from "./types.js";
import { createRedisAdapter } from "./redis-adapter.js";

/**
 * Create a backbone adapter from config. Use this to swap backbones
 * (Redis, RabbitMQ, Kafka) by changing config.backbone.type.
 */
export function createBackbone(config: BackboneConfig): BackboneAdapter {
  switch (config.type) {
    case "redis":
      return createRedisAdapter(config);
    case "rabbitmq":
      throw new Error("RabbitMQ backbone not implemented; use type: redis or add RabbitMQ adapter");
    case "kafka":
      throw new Error("Kafka backbone not implemented; use type: redis or add Kafka adapter");
    default:
      throw new Error(`Unknown backbone type: ${(config as BackboneConfig).type}`);
  }
}
