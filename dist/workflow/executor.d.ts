import type { AppCircuitBreaker } from "../fault/circuit-breaker.js";
import type { CapabilityInput } from "../types/json.js";
import type { SequentialStep, ParallelStep } from "../schema/index.js";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { WorkflowContext, WorkflowRunResult } from "./types.js";
import type { RunRegistry } from "../backbone/run-registry.js";
import { type RunInfo } from "../runtime/run-context.js";
export interface RunWorkflowOptions {
    /** When set, each step is run through the breaker; after threshold failures the circuit opens and the run fails. */
    circuitBreaker?: AppCircuitBreaker;
    /** When set (scheduler mode), run is registered for kill and cancel is checked between steps. */
    runRegistry?: RunRegistry | null;
}
export declare function executeStep(runtime: OrgRuntime, step: SequentialStep | ParallelStep, context: WorkflowContext, runInfo?: RunInfo): Promise<WorkflowContext>;
export declare function executeParallelStep(runtime: OrgRuntime, step: ParallelStep, context: WorkflowContext, runInfo?: RunInfo): Promise<WorkflowContext>;
/**
 * Run a workflow by id using the LangGraph workflow engine. Executes steps as graph nodes;
 * sequential and parallel steps supported. State is persisted at each super-step via
 * LangGraph checkpointer (thread_id = workflowId:runId). When options.circuitBreaker
 * is set, the full invoke runs through the breaker.
 */
export declare function runWorkflow(runtime: OrgRuntime, workflowId: string, initialInput?: CapabilityInput, options?: RunWorkflowOptions): Promise<WorkflowRunResult>;
//# sourceMappingURL=executor.d.ts.map