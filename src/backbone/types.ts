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
 * Minimal backbone contract: messaging only. Use this type when you only need
 * connect, disconnect, publish, and subscribe. New backbones can implement
 * just this and omit optional store/semaphore/registry features.
 */
export interface BackboneMessaging {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(queueName: string, payload: BackbonePayload): Promise<void>;
  subscribe(
    queueName: string,
    handler: (payload: string) => void | Promise<void>
  ): Promise<() => void>;
}

/** Optional: backbone that can create a workflow semaphore (e.g. Redis). */
export interface WorkflowSemaphoreProvider {
  createWorkflowSemaphore(maxConcurrent: number): WorkflowSemaphore;
}

/** Optional: backbone that can create a run registry for kill support (e.g. Redis). */
export interface RunRegistryProvider {
  createRunRegistry(): (RunRegistry & RunRegistryCancel) | null;
}

/** Optional: backbone that can create a checkpoint store (e.g. Redis). */
export interface CheckpointStoreProvider {
  createCheckpointStore(): CheckpointStore;
}

/** Optional: backbone that can create a capability key-value store (e.g. Redis). */
export interface CapabilityStoreProvider {
  createCapabilityStore(): CapabilityStore;
}

/**
 * Full backbone adapter. Core contract is BackboneMessaging (connect, disconnect,
 * publish, subscribe). Optional methods expose backend-specific features;
 * callers use them when present (e.g. adapter.createCheckpointStore?.()).
 * Implementations may provide only the core and omit optional methods.
 */
export interface BackboneAdapter extends BackboneMessaging {
  /** When present, the backbone supports a workflow semaphore (e.g. Redis). */
  createWorkflowSemaphore?(maxConcurrent: number): WorkflowSemaphore;

  /** When present, the backbone supports run registry and kill (e.g. Redis). */
  createRunRegistry?(): (RunRegistry & RunRegistryCancel) | null;

  /** When present, the backbone supports checkpoint persistence (e.g. Redis). */
  createCheckpointStore?(): CheckpointStore;

  /** When present, the backbone supports capability key-value store (e.g. Redis). */
  createCapabilityStore?(): CapabilityStore;
}
