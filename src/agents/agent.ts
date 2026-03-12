import type {
  CapabilityInput,
  CapabilityInstance,
  CapabilityOutput,
} from "../types/json.js";
import type { RunContext } from "../runtime/run-context.js";
import type { RuntimeWithMiddleware } from "../runtime/middleware.js";
import {
  runAgentPipeline,
  executeCapabilityWithMiddleware,
} from "../runtime/middleware.js";

export interface Agent {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly role: string;
  readonly fallback: string | undefined;
  readonly maxConcurrentTasks: number | undefined;
  invoke(
    action: string,
    input?: CapabilityInput,
    runContext?: RunContext
  ): Promise<CapabilityOutput>;
}

export function createAgent(
  id: string,
  provider: string,
  model: string,
  role: string,
  capabilities: Map<string, CapabilityInstance>,
  fallback: string | undefined,
  maxConcurrentTasks: number | undefined,
  runtime: RuntimeWithMiddleware
): Agent {
  return {
    id,
    provider,
    model,
    role,
    fallback,
    maxConcurrentTasks,
    async invoke(
      action: string,
      input?: CapabilityInput,
      runContext?: RunContext
    ): Promise<CapabilityOutput> {
      const cap = capabilities.get(action);
      if (!cap) {
        throw new Error(`Agent "${id}" has no capability "${action}"`);
      }
      const doInvoke = (): Promise<CapabilityOutput> =>
        executeCapabilityWithMiddleware(
          runtime,
          action,
          cap,
          input ?? {},
          runContext ?? { invokeCapability: async () => ({}) },
          id
        );
      const agentMiddlewares = runtime.agentMiddleware ?? [];
      if (agentMiddlewares.length === 0) {
        return doInvoke();
      }
      return runAgentPipeline(
        agentMiddlewares,
        {
          agentId: id,
          action,
          input: input ?? {},
          runContext: runContext ?? { invokeCapability: async () => ({}) },
          runtime,
        },
        doInvoke
      );
    },
  };
}
