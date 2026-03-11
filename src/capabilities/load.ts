import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { getDefaultCapabilityResolvers, type CapabilityResolver } from "./default-resolvers.js";

export type { CapabilityResolver } from "./default-resolvers.js";

/**
 * Build a map of capability id -> CapabilityInstance from resolved org config.
 * Uses the given resolvers in order; first resolver that returns an instance wins.
 * When resolvers is omitted, uses default (bundled, skill, inline-tool).
 * Capabilities with source are not yet supported.
 */
export function loadCapabilities(
  config: OrgConfig,
  resolvers?: CapabilityResolver[]
): Map<string, CapabilityInstance> {
  const list = resolvers ?? getDefaultCapabilityResolvers();
  const map = new Map<string, CapabilityInstance>();
  for (const [id, def] of Object.entries(config.capabilities)) {
    if (def.source) {
      throw new Error(
        `Capability "${id}" has source "${def.source}"; repo-pulled capabilities are not yet supported.`
      );
    }
    let instance: CapabilityInstance | undefined;
    for (const resolve of list) {
      instance = resolve(id, def);
      if (instance) break;
    }
    if (!instance) {
      throw new Error(`No resolver could create capability "${id}".`);
    }
    map.set(id, instance);
  }
  return map;
}
