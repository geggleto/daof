import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled produce_prd capability (Planner). Input: { description, existing_capabilities? }.
 * Output: { prd } or { ok: false, error }. Uses runContext.agentLlm.
 */
export declare function createProducePrdInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=produce_prd.d.ts.map