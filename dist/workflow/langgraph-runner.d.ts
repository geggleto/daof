import { MemorySaver } from "@langchain/langgraph";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { CapabilityInput } from "../types/json.js";
import type { WorkflowRunResult } from "./types.js";
import type { RunRegistry } from "../backbone/run-registry.js";
import type { AppCircuitBreaker } from "../fault/circuit-breaker.js";
/** Checkpointer type compatible with LangGraph compile(); default is MemorySaver when not provided. */
export type LangGraphCheckpointer = InstanceType<typeof MemorySaver>;
export interface LangGraphRunOptions {
    circuitBreaker?: AppCircuitBreaker;
    runRegistry?: RunRegistry | null;
    /** When provided, used for workflow state persistence; otherwise MemorySaver. Enables Redis-backed or test checkpointers. */
    checkpointer?: LangGraphCheckpointer;
}
/**
 * Run a workflow using LangGraph. Builds a StateGraph from the workflow definition,
 * compiles with a checkpointer (MemorySaver), and invokes with thread_id for
 * persistence and resume. When runRegistry is set, registers the run for kill
 * and checks cancel between steps. Passes __event_id and __run_id in context for traceability.
 */
export declare function runWorkflowWithLangGraph(runtime: OrgRuntime, workflowId: string, initialInput?: CapabilityInput, runId?: string, options?: LangGraphRunOptions): Promise<WorkflowRunResult>;
//# sourceMappingURL=langgraph-runner.d.ts.map