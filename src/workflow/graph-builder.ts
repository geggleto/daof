import { START, END, StateGraph } from "@langchain/langgraph";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { WorkflowConfig } from "../schema/index.js";
import type { WorkflowState, WorkflowStateUpdate } from "./langgraph-state.js";
import { WorkflowStateAnnotation } from "./langgraph-state.js";
import { executeStep } from "./executor.js";
import type { WorkflowContext } from "./types.js";
import { WorkflowCancelledError } from "./types.js";
import type { RunRegistry } from "../backbone/run-registry.js";

/**
 * Build a LangGraph StateGraph for a DAOF workflow. One node per step; nodes call
 * executeStep and return context updates. When runRegistry is provided, each node
 * checks for cancellation before executing (between-step cancel).
 */
export function buildWorkflowGraph(
  runtime: OrgRuntime,
  workflow: WorkflowConfig,
  runRegistry?: RunRegistry | null,
  workflowId?: string
): StateGraph<typeof WorkflowStateAnnotation, WorkflowState, WorkflowStateUpdate, string> {
  const steps = workflow.steps;
  const graph = new StateGraph(WorkflowStateAnnotation) as StateGraph<
    typeof WorkflowStateAnnotation,
    WorkflowState,
    WorkflowStateUpdate,
    string
  >;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const nodeName = `step_${i}`;

    const nodeFn = async (
      state: WorkflowState,
      config?: { configurable?: { run_id?: string } }
    ): Promise<WorkflowStateUpdate> => {
      const runId = config?.configurable?.run_id;
      if (runRegistry && runId && (await runRegistry.isCancelled(runId))) {
        throw new WorkflowCancelledError(runId);
      }
      const context: WorkflowContext = (state.context ?? {}) as WorkflowContext;
      const runInfo =
        workflowId && runId ? { workflowId, runId } : undefined;
      const nextContext = await executeStep(runtime, step, context, runInfo);
      return { context: nextContext };
    };

    graph.addNode(nodeName, nodeFn);
  }

  if (steps.length === 0) {
    graph.addEdge(START, END);
  } else {
    graph.addEdge(START, "step_0");
    for (let i = 0; i < steps.length - 1; i++) {
      graph.addEdge(`step_${i}`, `step_${i + 1}`);
    }
    graph.addEdge(`step_${steps.length - 1}`, END);
  }

  return graph;
}
