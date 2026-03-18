import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled query_capability_registry capability. Input: { tags?: string[], category?: string, match_all_tags?: boolean }.
 * Output: { capability_ids: string[], agent_ids: string[] } or { ok: false, error }.
 * Uses runContext.registry to query by metadata; agents can use this to discover existing skills/capabilities and avoid duplicates.
 */
export declare function createQueryCapabilityRegistryInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=query_capability_registry.d.ts.map