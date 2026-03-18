import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled merge_and_write capability. Input: { org_path, generated_yaml }.
 * Output: { summary, added_count } or { ok: false, error }. No LLM; reads org, merges, validates, writes.
 */
export declare function createMergeAndWriteInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=merge_and_write.d.ts.map