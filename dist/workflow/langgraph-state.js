import { Annotation } from "@langchain/langgraph";
/**
 * LangGraph state for DAOF workflows. Single channel "context" accumulates
 * step outputs (agent id -> CapabilityOutput) via reducer merge.
 */
export const WorkflowStateAnnotation = Annotation.Root({
    context: Annotation({
        reducer: (left, right) => ({ ...left, ...right }),
        default: () => ({}),
    }),
});
//# sourceMappingURL=langgraph-state.js.map