/**
 * Registry for bundled capabilities. Each bundled module calls registerBundled on load
 * so new capabilities can be added without editing this file.
 */
import type { CapabilityDefinition } from "../../schema/index.js";
import type { CapabilityInstance } from "../../types/json.js";

export type BundledCapabilityFactory = (
  capabilityId: string,
  def: CapabilityDefinition
) => CapabilityInstance;

const registry: Record<string, BundledCapabilityFactory> = {};

export function registerBundled(capabilityId: string, factory: BundledCapabilityFactory): void {
  registry[capabilityId] = factory;
}

export function getBundledCapability(
  capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance | undefined {
  const factory = registry[capabilityId];
  if (!factory) return undefined;
  return factory(capabilityId, def);
}

export function getBundledIds(): Set<string> {
  return new Set<string>(Object.keys(registry));
}
