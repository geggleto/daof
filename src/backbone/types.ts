import type { JsonValue } from "../types/json.js";
import type { WorkflowSemaphore } from "./semaphore.js";
import type { RunRegistry, RunRegistryCancel } from "./run-registry.js";
import type { CheckpointStore } from "./checkpoint-store.js";
import type { CapabilityStore } from "./capability-store.js";

/**
 * Payload sent or received on a backbone queue.
 * Adapters serialize/deserialize (e.g. JSON) as needed.
 */
export type BackbonePayload = Record<string, JsonValue> | string;

/**
 * Adapter interface for backbone (Redis, RabbitMQ, Kafka).
 * Implementations are swappable via config.backbone.type.
 * Optional methods expose backend-specific features (semaphore, run registry, stores);
 * callers use them when present instead of branching on config.backbone.type.
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

  /** When present, the backbone supports a workflow semaphore (e.g. Redis). */
  createWorkflowSemaphore?(maxConcurrent: number): WorkflowSemaphore;

  /** When present, the backbone supports run registry and kill (e.g. Redis). */
  createRunRegistry?(): (RunRegistry & RunRegistryCancel) | null;

  /** When present, the backbone supports checkpoint persistence (e.g. Redis). */
  createCheckpointStore?(): CheckpointStore;

  /** When present, the backbone supports capability key-value store (e.g. Redis). */
  createCapabilityStore?(): CapabilityStore;
}
