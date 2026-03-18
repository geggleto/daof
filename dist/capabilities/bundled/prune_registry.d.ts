import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled prune_registry capability. Input: { older_than_days?: number; dry_run?: boolean }.
 * Lists stale registry entries (by last_accessed / updated_at); if not dry_run, archives them (sets archived_at).
 * Output: { ok: true, archived_capability_ids, archived_agent_ids, dry_run } or { ok: false, error }.
 * Requires runContext.registry. Used by the Curator agent.
 */
export declare function createPruneRegistryInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=prune_registry.d.ts.map