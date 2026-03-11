import type { CapabilityDefinition } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { getBundledCapability } from "./bundled/index.js";
import { createSkillRunnerInstance } from "./bundled/skill_runner.js";
import { createInlineToolInstance } from "./adapters/inline-tool.js";

export type CapabilityResolver = (
  id: string,
  def: CapabilityDefinition
) => CapabilityInstance | undefined;

/**
 * Default resolvers: try bundled, then skill, then inline-tool.
 * Used when loadCapabilities is called without custom resolvers.
 */
export function getDefaultCapabilityResolvers(): CapabilityResolver[] {
  return [
    (id, def) => getBundledCapability(id, def) ?? undefined,
    (id, def) => (def.type === "skill" ? createSkillRunnerInstance(id, def) : undefined),
    (id, def) => createInlineToolInstance(id, def),
  ];
}
