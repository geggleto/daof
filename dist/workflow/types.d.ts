import type { CapabilityOutput } from "../types/json.js";
/**
 * Accumulated outputs from workflow steps, keyed by agent id.
 */
export type WorkflowContext = Record<string, CapabilityOutput>;
export interface WorkflowRunResult {
    success: boolean;
    context: WorkflowContext;
    error?: Error;
    /** Run/ticket ID for observability (daof ticket <runId>). */
    runId?: string;
}
export interface CronTrigger {
    type: "cron";
    expression: string;
}
export interface EventTrigger {
    type: "event";
    eventName: string;
}
export interface OnDemandTrigger {
    type: "on_demand";
}
export type ParsedTrigger = CronTrigger | EventTrigger | OnDemandTrigger;
/** Thrown when a workflow run is cancelled via daof kill <run_id>. */
export declare class WorkflowCancelledError extends Error {
    readonly runId: string;
    constructor(runId: string);
}
//# sourceMappingURL=types.d.ts.map