import type { CapabilityInput, CapabilityOutput } from "../types/json.js";
import type { CapabilityInstance } from "../types/json.js";
import type { RunContext } from "./run-context.js";
import type { CapabilityStore } from "../backbone/capability-store.js";
import type { OrgConfig } from "../schema/index.js";

/**
 * Minimal runtime shape needed to run the middleware pipeline (avoids circular import with bootstrap).
 */
export interface RuntimeWithMiddleware {
  config: OrgConfig;
  capabilities: Map<string, CapabilityInstance>;
  capabilityStore?: CapabilityStore;
  metricsStore?: CapabilityStore;
  agentMiddleware?: AgentMiddleware[];
  capabilityMiddleware?: CapabilityMiddleware[];
}

export interface AgentMiddlewareContext {
  agentId: string;
  action: string;
  input: CapabilityInput;
  runContext: RunContext;
  runtime: RuntimeWithMiddleware;
}

export interface CapabilityMiddlewareContext {
  capabilityId: string;
  input: CapabilityInput;
  runContext: RunContext;
  runtime: RuntimeWithMiddleware;
  /** Set when the capability is invoked from an agent step (workflow or build). */
  agentId?: string;
}

export type AgentMiddleware = (
  ctx: AgentMiddlewareContext,
  next: () => Promise<CapabilityOutput>
) => Promise<CapabilityOutput>;

export type CapabilityMiddleware = (
  ctx: CapabilityMiddlewareContext,
  next: () => Promise<CapabilityOutput>
) => Promise<CapabilityOutput>;

/**
 * Run the agent middleware pipeline; final next is the actual capability execution.
 */
export async function runAgentPipeline(
  middlewares: AgentMiddleware[],
  ctx: AgentMiddlewareContext,
  next: () => Promise<CapabilityOutput>
): Promise<CapabilityOutput> {
  if (middlewares.length === 0) return next();
  let i = 0;
  const runNext = (): Promise<CapabilityOutput> => {
    if (i >= middlewares.length) return next();
    const m = middlewares[i++]!;
    return m(ctx, runNext);
  };
  return runNext();
}

/**
 * Run the capability middleware pipeline; final next is the actual instance.execute.
 */
export async function runCapabilityPipeline(
  middlewares: CapabilityMiddleware[],
  ctx: CapabilityMiddlewareContext,
  next: () => Promise<CapabilityOutput>
): Promise<CapabilityOutput> {
  if (middlewares.length === 0) return next();
  let i = 0;
  const runNext = (): Promise<CapabilityOutput> => {
    if (i >= middlewares.length) return next();
    const m = middlewares[i++]!;
    return m(ctx, runNext);
  };
  return runNext();
}

/**
 * Execute a capability through the capability middleware pipeline (if any), then instance.execute.
 * Used by createAgent and by createRunContext's invokeCapability.
 */
export async function executeCapabilityWithMiddleware(
  runtime: RuntimeWithMiddleware,
  capabilityId: string,
  instance: CapabilityInstance,
  input: CapabilityInput,
  runContext: RunContext,
  agentId?: string
): Promise<CapabilityOutput> {
  const middlewares = runtime.capabilityMiddleware ?? [];
  const ctx: CapabilityMiddlewareContext = {
    capabilityId,
    input,
    runContext,
    runtime,
    ...(agentId !== undefined && { agentId }),
  };
  const next = (): Promise<CapabilityOutput> =>
    instance.execute(input, runContext);
  return runCapabilityPipeline(middlewares, ctx, next);
}
