import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { registerBundled } from "./registry.js";

/**
 * Bundled stub for the overseer capability: generates agents, capabilities, and workflows from a description.
 * Stub implementation returns ok; full implementation would orchestrate planner/generator/merge or similar.
 */
export function createGenerateAgentsCapabilitiesAndWorkflowsInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      _input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      return { ok: true };
    },
  };
}
registerBundled("generate_agents_capabilities_and_workflows", createGenerateAgentsCapabilitiesAndWorkflowsInstance);
