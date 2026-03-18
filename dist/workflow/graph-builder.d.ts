import { StateGraph } from "@langchain/langgraph";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { WorkflowConfig } from "../schema/index.js";
import type { WorkflowState, WorkflowStateUpdate } from "./langgraph-state.js";
import { WorkflowStateAnnotation } from "./langgraph-state.js";
import type { RunRegistry } from "../backbone/run-registry.js";
/**
 * Build a LangGraph StateGraph for a DAOF workflow. One node per step; nodes call
 * executeStep and return context updates. When runRegistry is provided, each node
 * checks for cancellation before executing (between-step cancel).
 */
export declare function buildWorkflowGraph(runtime: OrgRuntime, workflow: WorkflowConfig, runRegistry?: RunRegistry | null, workflowId?: string): StateGraph<typeof WorkflowStateAnnotation, WorkflowState, WorkflowStateUpdate, string>;
//# sourceMappingURL=graph-builder.d.ts.map