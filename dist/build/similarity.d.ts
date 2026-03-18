import type { OrgConfig } from "../schema/index.js";
import type { RegistryStore } from "../registry/registry-store.js";
import { type SimilarityDuplicate } from "../capabilities/bundled/verify_similarity.js";
/**
 * Registry-based duplicate check: for each proposed capability/agent, query registry by metadata;
 * if a registry entry matches (same tags/category/intent), treat as duplicate (proposed id vs registry id).
 */
export declare function runRegistryDuplicateCheck(registry: RegistryStore, generated: {
    capabilities: Record<string, unknown>;
    agents: Record<string, unknown>;
}): Promise<SimilarityDuplicate[]>;
/** Run similarity check; returns list of duplicate pairs. On capability error, throws. */
export declare function runSimilarityCheck(providerId: string, config: OrgConfig, generated: {
    capabilities: Record<string, unknown>;
    agents: Record<string, unknown>;
    workflows: Record<string, unknown>;
}): Promise<SimilarityDuplicate[]>;
//# sourceMappingURL=similarity.d.ts.map