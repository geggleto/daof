import type { AppCircuitBreaker } from "../fault/circuit-breaker.js";
import type { CapabilityInput, CapabilityOutput } from "../types/json.js";
import type { SequentialStep, ParallelStep } from "../schema/index.js";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import type { WorkflowContext, WorkflowRunResult } from "./types.js";
import type { RunRegistry } from "../backbone/run-registry.js";
import { createRunContext, type RunInfo } from "../runtime/run-context.js";
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

function generateStepId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeSequentialStep(
  runtime: OrgRuntime,
  step: SequentialStep,
  context: WorkflowContext,
  runInfo?: RunInfo
): Promise<WorkflowContext> {
  if (step.condition && !evaluateCondition(context, step.condition)) {
    return context;
  }
  const agent = runtime.agents.get(step.agent);
  if (!agent) {
    throw new Error(`Workflow references unknown agent: ${step.agent}`);
  }
  const stepId = generateStepId();
  const input: CapabilityInput = step.params ? resolveParams(context, step.params) : {};
  const agentLlm = {
    provider: agent.provider,
    model: agent.model,
    apiKey: getProviderApiKey(agent.provider),
  };
  const runContext = createRunContext(runtime, step.action, agentLlm, runInfo, stepId, runInfo?.runId, step.agent);
  const startTime = Date.now();
  let output: CapabilityOutput;
  try {
    output = await agent.invoke(step.action, input, runContext);
  } catch (err) {
    throw err;
  }
  const durationMs = Date.now() - startTime;
  // Attach step duration and step ID so downstream steps or Logger can use them (e.g. {{ agent.__step_duration_ms }}, {{ agent.__step_id }}).
  const outputWithDuration = { ...output, __step_duration_ms: durationMs, __step_id: stepId };
  const next = { ...context, [step.agent]: outputWithDuration };
  return next;
}

export async function executeStep(
  runtime: OrgRuntime,
  step: SequentialStep | ParallelStep,
  context: WorkflowContext,
  runInfo?: RunInfo
): Promise<WorkflowContext> {
  if (isParallelStep(step)) {
    return executeParallelStep(runtime, step, context, runInfo);
  }
  return executeSequentialStep(runtime, step, context, runInfo);
}

export async function executeParallelStep(
  runtime: OrgRuntime,
  step: ParallelStep,
  context: WorkflowContext,
  runInfo?: RunInfo
): Promise<WorkflowContext> {
  // Stagger start of each branch by 1s to avoid multiple processes contending for the same lock (e.g. Cursor CLI update check).
  const PARALLEL_STAGGER_MS = 1000;
  const results = await Promise.all(
    step.parallel.map((s, i) =>
      delayMs(i * PARALLEL_STAGGER_MS).then(() =>
        executeSequentialStep(runtime, s, context, runInfo)
      )
    )
  );
  const merged: WorkflowContext = { ...context };
  const stepIds: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const ctx = results[i]!;
    const seqStep = step.parallel[i]!;
    const agentId = seqStep.agent;
    const output = ctx[agentId];
    if (output !== undefined) {
      merged[`${agentId}_${i}`] = output;
      const stepId = output.__step_id;
      if (typeof stepId === "string") stepIds.push(stepId);
    }
  }
  if (stepIds.length > 0) {
    (merged as Record<string, CapabilityOutput | string[]>).__parallel_step_ids = stepIds;
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
