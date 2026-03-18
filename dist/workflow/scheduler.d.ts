import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { WorkflowSemaphore } from "../backbone/semaphore.js";
import type { RunRegistry } from "../backbone/run-registry.js";
export interface HeartbeatPayload {
    event_id: string;
    at: number;
}
/**
 * Start the heartbeat timer. On each tick, emits a payload with event_id (UUID)
 * and invokes the given listener. Does not invoke workflows directly.
 * Returns a stop function.
 */
export declare function startHeartbeat(runtime: OrgRuntime, onHeartbeat: (payload: HeartbeatPayload) => void | Promise<void>): () => void;
/**
 * Orchestrator: given a heartbeat payload, find all workflows with cron trigger
 * that are due, acquire semaphore slot for each, run workflow with event_id and
 * run_id, then release. Registers run in registry and checks cancel between steps
 * (handled inside runWorkflow when registry is provided).
 */
export declare function onHeartbeatRunDueWorkflows(runtime: OrgRuntime, payload: HeartbeatPayload, semaphore: WorkflowSemaphore, runRegistry: RunRegistry | null): Promise<void>;
/**
 * Subscribe to the backbone events queue and run workflows whose trigger matches the received event_type.
 * Uses the same semaphore and run registry as cron so concurrency and daof kill apply.
 * Returns a promise that resolves to a stop function (unsubscribe).
 */
export declare function startEventSubscriber(runtime: OrgRuntime, semaphore: WorkflowSemaphore, runRegistry: RunRegistry | null): Promise<() => void>;
//# sourceMappingURL=scheduler.d.ts.map