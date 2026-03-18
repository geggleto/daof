import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled verify_build capability (Verifier). Input: { prd, summary }.
 * Output: { pass: boolean } or { ok: false, error }. Uses runContext.agentLlm.
 */
export declare function createVerifyBuildInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=verify_build.d.ts.map