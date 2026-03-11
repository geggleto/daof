import { Annotation } from "@langchain/langgraph";
import type { WorkflowContext } from "./types.js";

/**
 * LangGraph state for DAOF workflows. Single channel "context" accumulates
 * step outputs (agent id -> CapabilityOutput) via reducer merge.
 */
export const WorkflowStateAnnotation = Annotation.Root({
  context: Annotation<WorkflowContext>({
    reducer: (left: WorkflowContext, right: WorkflowContext) => ({ ...left, ...right }),
    default: () => ({}),
  }),
});

export type WorkflowState = (typeof WorkflowStateAnnotation)["State"];
export type WorkflowStateUpdate = (typeof WorkflowStateAnnotation)["Update"];
