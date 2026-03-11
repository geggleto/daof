import type {
  CapabilityInput,
  CapabilityInstance,
  CapabilityOutput,
} from "../types/json.js";
import type { RunContext } from "../runtime/run-context.js";

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
  maxConcurrentTasks: number | undefined
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
      return cap.execute(input ?? {}, runContext);
    },
  };
}
