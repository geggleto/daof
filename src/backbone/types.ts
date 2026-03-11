import type { JsonValue } from "../types/json.js";

/**
 * Payload sent or received on a backbone queue.
 * Adapters serialize/deserialize (e.g. JSON) as needed.
 */
export type BackbonePayload = Record<string, JsonValue> | string;

/**
 * Adapter interface for backbone (Redis, RabbitMQ, Kafka).
 * Implementations are swappable via config.backbone.type.
 */
export interface BackboneAdapter {
  /** Connect to the backbone. Idempotent. */
  connect(): Promise<void>;

  /** Disconnect and release resources. */
  disconnect(): Promise<void>;

  /** Publish a message to the named queue. */
  publish(queueName: string, payload: BackbonePayload): Promise<void>;

  /**
   * Subscribe to the named queue. Handler receives raw string (caller may JSON.parse).
   * Returns an unsubscribe function.
   */
  subscribe(
    queueName: string,
    handler: (payload: string) => void | Promise<void>
  ): Promise<() => void>;
}
