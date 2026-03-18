import type { WorkflowContext } from "./types.js";
/**
 * LangGraph state for DAOF workflows. Single channel "context" accumulates
 * step outputs (agent id -> CapabilityOutput) via reducer merge.
 */
export declare const WorkflowStateAnnotation: import("@langchain/langgraph").AnnotationRoot<{
    context: import("@langchain/langgraph").BaseChannel<WorkflowContext, WorkflowContext | import("@langchain/langgraph").OverwriteValue<WorkflowContext>, unknown>;
}>;
export type WorkflowState = (typeof WorkflowStateAnnotation)["State"];
export type WorkflowStateUpdate = (typeof WorkflowStateAnnotation)["Update"];
//# sourceMappingURL=langgraph-state.d.ts.map