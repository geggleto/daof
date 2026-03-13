import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { registerBundled } from "./registry.js";

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string");
  }
  return [];
}

/**
 * Bundled query_capability_registry capability. Input: { tags?: string[], category?: string, match_all_tags?: boolean }.
 * Output: { capability_ids: string[], agent_ids: string[] } or { ok: false, error }.
 * Uses runContext.registry to query by metadata; agents can use this to discover existing skills/capabilities and avoid duplicates.
 */
export function createQueryCapabilityRegistryInstance(
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
          error: "query_capability_registry requires runContext.registry (MongoDB registry not connected).",
        };
      }
      const tags = toStringList(input.tags);
      const category = typeof input.category === "string" ? input.category : undefined;
      const matchAll = input.match_all_tags === true;

      if (tags.length > 0) {
        const result = await registry.queryByTags(tags, { matchAll });
        return { capability_ids: result.capability_ids, agent_ids: result.agent_ids };
      }
      if (category) {
        const result = await registry.queryByCategory(category);
        return { capability_ids: result.capability_ids, agent_ids: result.agent_ids };
      }
      const result = await registry.listAll();
      return { capability_ids: result.capability_ids, agent_ids: result.agent_ids };
    },
  };
}
registerBundled("query_capability_registry", createQueryCapabilityRegistryInstance);
