import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { registerBundled } from "./registry.js";

const DEFAULT_OLDER_THAN_DAYS = 90;

/**
 * Bundled prune_registry capability. Input: { older_than_days?: number; dry_run?: boolean }.
 * Lists stale registry entries (by last_accessed / updated_at); if not dry_run, archives them (sets archived_at).
 * Output: { ok: true, archived_capability_ids, archived_agent_ids, dry_run } or { ok: false, error }.
 * Requires runContext.registry. Used by the Curator agent.
 */
export function createPruneRegistryInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const registry = runContext?.registry;
      if (!registry) {
        return {
          ok: false,
          error: "prune_registry requires runContext.registry (MongoDB registry not connected).",
        };
      }
      const olderThanDays =
        typeof input.older_than_days === "number" && input.older_than_days >= 0
          ? input.older_than_days
          : DEFAULT_OLDER_THAN_DAYS;
      const dryRun = input.dry_run === true;

      const stale = await registry.listStale({ olderThanDays, includeArchived: false });
      if (dryRun) {
        return {
          ok: true,
          archived_capability_ids: stale.capability_ids,
          archived_agent_ids: stale.agent_ids,
          dry_run: true,
        };
      }
      const result = await registry.archiveStale({ olderThanDays });
      return {
        ok: true,
        archived_capability_ids: result.archived_capability_ids,
        archived_agent_ids: result.archived_agent_ids,
        dry_run: false,
      };
    },
  };
}
registerBundled("prune_registry", createPruneRegistryInstance);
