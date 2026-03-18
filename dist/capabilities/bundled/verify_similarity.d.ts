import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
export interface SimilarityDuplicate {
    id1: string;
    id2: string;
    type: "capability" | "agent";
    reason?: string;
}
/**
 * Bundled verify_similarity capability. Input: { proposed_capabilities, existing_capabilities, proposed_agents, existing_agents } (each a record).
 * Output: { duplicates: SimilarityDuplicate[] } or { ok: false, error }.
 * Uses runContext.agentLlm to call LLM; compares proposed vs proposed and proposed vs existing to find near-duplicates.
 */
export declare function createVerifySimilarityInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=verify_similarity.d.ts.map