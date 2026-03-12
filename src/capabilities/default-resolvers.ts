import type { CapabilityDefinition } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { getBundledCapability } from "./bundled/index.js";
import { createSkillRunnerInstance } from "./bundled/skill_runner.js";
import { createInlineToolInstance } from "./adapters/inline-tool.js";

export type CapabilityResolver = (
  id: string,
  def: CapabilityDefinition
) => CapabilityInstance | undefined;

export type CapabilityTypeResolver = (
  id: string,
  def: CapabilityDefinition
) => CapabilityInstance | undefined;

const typeResolverMap: Record<string, CapabilityTypeResolver> = {};

/**
 * Register a resolver for a capability definition type (e.g. "skill", "hybrid").
 * New types can be added without editing the default resolver chain.
 */
export function registerCapabilityTypeResolver(type: string, resolver: CapabilityTypeResolver): void {
  typeResolverMap[type] = resolver;
}

function resolveByType(id: string, def: CapabilityDefinition): CapabilityInstance | undefined {
  const type = def.type ?? "tool";
  const resolver = typeResolverMap[type];
  return resolver ? resolver(id, def) : undefined;
}

registerCapabilityTypeResolver("skill", createSkillRunnerInstance);

/**
 * Default resolvers: try bundled, then type-based (e.g. skill), then inline-tool as catch-all.
 * Used when loadCapabilities is called without custom resolvers.
 */
export function getDefaultCapabilityResolvers(): CapabilityResolver[] {
  return [
    (id, def) => getBundledCapability(id, def) ?? undefined,
    (id, def) => resolveByType(id, def),
    (id, def) => createInlineToolInstance(id, def),
  ];
}
