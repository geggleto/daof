import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled generate_yaml capability (Generator). Input: { description, prd, existing_capabilities? }.
 * Output: { yaml } or { ok: false, error }. Uses runContext.agentLlm.
 */
export declare function createGenerateYamlInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=generate_yaml.d.ts.map