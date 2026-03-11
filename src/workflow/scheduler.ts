import type { OrgRuntime } from "../runtime/bootstrap.js";
import {
  DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
  DEFAULT_MAX_CONCURRENT_WORKFLOWS,
} from "../schema/index.js";
import { parseTrigger } from "./trigger.js";
import { isCronDue } from "./cron-due.js";
import { runWorkflow } from "./executor.js";
import type { WorkflowSemaphore } from "../backbone/semaphore.js";
import type { RunRegistry } from "../backbone/run-registry.js";

export interface HeartbeatPayload {
  event_id: string;
  at: number;
}

function randomUUID(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getHeartbeatIntervalSeconds(runtime: OrgRuntime): number {
  return (
    runtime.config.scheduler?.heartbeat_interval_seconds ??
    DEFAULT_HEARTBEAT_INTERVAL_SECONDS
  );
}

function getMaxConcurrentWorkflows(runtime: OrgRuntime): number {
  return (
    runtime.config.scheduler?.max_concurrent_workflows ??
    DEFAULT_MAX_CONCURRENT_WORKFLOWS
  );
}

/**
 * Start the heartbeat timer. On each tick, emits a payload with event_id (UUID)
 * and invokes the given listener. Does not invoke workflows directly.
 * Returns a stop function.
 */
export function startHeartbeat(
  runtime: OrgRuntime,
  onHeartbeat: (payload: HeartbeatPayload) => void | Promise<void>
): () => void {
  const intervalMs = getHeartbeatIntervalSeconds(runtime) * 1000;
  const timer = setInterval(() => {
    const payload: HeartbeatPayload = {
      event_id: randomUUID(),
      at: Date.now(),
    };
    void Promise.resolve(onHeartbeat(payload)).catch((err) => {
      console.error("[scheduler] heartbeat listener error:", err);
    });
  }, intervalMs);

  return () => clearInterval(timer);
}

/**
 * Orchestrator: given a heartbeat payload, find all workflows with cron trigger
 * that are due, acquire semaphore slot for each, run workflow with event_id and
 * run_id, then release. Registers run in registry and checks cancel between steps
 * (handled inside runWorkflow when registry is provided).
 */
export async function onHeartbeatRunDueWorkflows(
  runtime: OrgRuntime,
  payload: HeartbeatPayload,
  semaphore: WorkflowSemaphore,
  runRegistry: RunRegistry | null
): Promise<void> {
  const workflows = runtime.config.workflows;
  for (const [workflowId, workflow] of Object.entries(workflows)) {
    let parsed;
    try {
      parsed = parseTrigger(workflow.trigger);
    } catch {
      continue;
    }
    if (parsed.type !== "cron") continue;
    if (!isCronDue(parsed.expression)) continue;

    const acquired = await semaphore.acquire();
    if (!acquired) continue;

    try {
      const initialInput: Record<string, import("../types/json.js").JsonValue> = {
        __event_id: payload.event_id,
      };
      await runWorkflow(runtime, workflowId, initialInput, {
        runRegistry,
      });
    } finally {
      await semaphore.release();
    }
  }
}

const DEFAULT_EVENTS_QUEUE = "events";

function getEventsQueueName(runtime: OrgRuntime): string {
  const queues = runtime.config.backbone?.config?.queues;
  if (Array.isArray(queues)) {
    const named = queues.find((q) => q?.name === DEFAULT_EVENTS_QUEUE);
    if (named) return named.name;
    if (queues[0] && typeof queues[0].name === "string") return queues[0].name;
  }
  return DEFAULT_EVENTS_QUEUE;
}

/**
 * Subscribe to the backbone events queue and run workflows whose trigger matches the received event_type.
 * Uses the same semaphore and run registry as cron so concurrency and daof kill apply.
 * Returns a promise that resolves to a stop function (unsubscribe).
 */
export async function startEventSubscriber(
  runtime: OrgRuntime,
  semaphore: WorkflowSemaphore,
  runRegistry: RunRegistry | null
): Promise<() => void> {
  if (!runtime.backbone) return () => {};

  const queueName = getEventsQueueName(runtime);

  const handler = async (raw: string) => {
    let data: { event_type?: string; payload?: Record<string, unknown> };
    try {
      data = JSON.parse(raw) as { event_type?: string; payload?: Record<string, unknown> };
    } catch {
      return;
    }
    const eventType = typeof data.event_type === "string" ? data.event_type : "";
    const payload = data.payload && typeof data.payload === "object" ? data.payload : {};
    if (!eventType) return;

    const workflows = runtime.config.workflows;
    for (const [workflowId, workflow] of Object.entries(workflows)) {
      let parsed;
      try {
        parsed = parseTrigger(workflow.trigger);
      } catch {
        continue;
      }
      if (parsed.type !== "event" || parsed.eventName !== eventType) continue;

      const acquired = await semaphore.acquire();
      if (!acquired) continue;

      try {
        const initialInput: Record<string, import("../types/json.js").JsonValue> = {
          ...payload,
          __event_id: randomUUID(),
        };
        await runWorkflow(runtime, workflowId, initialInput, { runRegistry });
      } catch (err) {
        console.error("[scheduler] event workflow error:", err);
      } finally {
        await semaphore.release();
      }
    }
  };

  return runtime.backbone.subscribe(queueName, handler);
}
