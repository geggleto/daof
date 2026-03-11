import type { CapabilityOutput } from "../types/json.js";

/**
 * Accumulated outputs from workflow steps, keyed by agent id.
 */
export type WorkflowContext = Record<string, CapabilityOutput>;

export interface WorkflowRunResult {
  success: boolean;
  context: WorkflowContext;
  error?: Error;
}

export interface CronTrigger {
  type: "cron";
  expression: string;
}

export interface EventTrigger {
  type: "event";
  eventName: string;
}

export type ParsedTrigger = CronTrigger | EventTrigger;

/** Thrown when a workflow run is cancelled via daof kill <run_id>. */
export class WorkflowCancelledError extends Error {
  constructor(public readonly runId: string) {
    super(`Workflow run cancelled: ${runId}`);
    this.name = "WorkflowCancelledError";
  }
}
