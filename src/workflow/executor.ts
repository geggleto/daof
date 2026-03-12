import type { AppCircuitBreaker } from "../fault/circuit-breaker.js";
import type { CapabilityInput, CapabilityOutput } from "../types/json.js";
import type { SequentialStep, ParallelStep } from "../schema/index.js";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { WorkflowContext, WorkflowRunResult } from "./types.js";
import type { RunRegistry } from "../backbone/run-registry.js";
import { createRunContext } from "../runtime/run-context.js";
import { getProviderApiKey } from "../providers/registry.js";
import { evaluateCondition, resolveParams } from "./context.js";

export interface RunWorkflowOptions {
  /** When set, each step is run through the breaker; after threshold failures the circuit opens and the run fails. */
  circuitBreaker?: AppCircuitBreaker;
  /** When set (scheduler mode), run is registered for kill and cancel is checked between steps. */
  runRegistry?: RunRegistry | null;
}

function isParallelStep(step: SequentialStep | ParallelStep): step is ParallelStep {
  return "parallel" in step && Array.isArray((step as ParallelStep).parallel);
}

async function executeSequentialStep(
  runtime: OrgRuntime,
  step: SequentialStep,
  context: WorkflowContext
): Promise<WorkflowContext> {
  if (step.condition && !evaluateCondition(context, step.condition)) {
    return context;
  }
  const agent = runtime.agents.get(step.agent);
  if (!agent) {
    throw new Error(`Workflow references unknown agent: ${step.agent}`);
  }
  const input: CapabilityInput = step.params ? resolveParams(context, step.params) : {};
  const agentLlm = {
    provider: agent.provider,
    model: agent.model,
    apiKey: getProviderApiKey(agent.provider),
  };
  const runContext = createRunContext(runtime, step.action, agentLlm);
  const startTime = Date.now();
  let output: CapabilityOutput;
  try {
    output = await agent.invoke(step.action, input, runContext);
  } catch (err) {
    throw err;
  }
  const durationMs = Date.now() - startTime;
  // Attach step duration so downstream steps or Logger can use it (e.g. {{ agent.__step_duration_ms }}).
  const outputWithDuration = { ...output, __step_duration_ms: durationMs };
  const next = { ...context, [step.agent]: outputWithDuration };
  return next;
}

export async function executeStep(
  runtime: OrgRuntime,
  step: SequentialStep | ParallelStep,
  context: WorkflowContext
): Promise<WorkflowContext> {
  if (isParallelStep(step)) {
    return executeParallelStep(runtime, step, context);
  }
  return executeSequentialStep(runtime, step, context);
}

export async function executeParallelStep(
  runtime: OrgRuntime,
  step: ParallelStep,
  context: WorkflowContext
): Promise<WorkflowContext> {
  const results = await Promise.all(
    step.parallel.map((s) => executeSequentialStep(runtime, s, context))
  );
  const merged: WorkflowContext = { ...context };
  for (const ctx of results) {
    for (const [agentId, output] of Object.entries(ctx)) {
      merged[agentId] = output;
    }
  }
  return merged;
}

/**
 * Run a workflow by id using the LangGraph workflow engine. Executes steps as graph nodes;
 * sequential and parallel steps supported. State is persisted at each super-step via
 * LangGraph checkpointer (thread_id = workflowId:runId). When options.circuitBreaker
 * is set, the full invoke runs through the breaker.
 */
export async function runWorkflow(
  runtime: OrgRuntime,
  workflowId: string,
  initialInput?: CapabilityInput,
  options?: RunWorkflowOptions
): Promise<WorkflowRunResult> {
  const { runWorkflowWithLangGraph } = await import("./langgraph-runner.js");
  return runWorkflowWithLangGraph(runtime, workflowId, initialInput, undefined, {
    circuitBreaker: options?.circuitBreaker,
    runRegistry: options?.runRegistry,
  });
}
