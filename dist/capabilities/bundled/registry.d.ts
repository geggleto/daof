/**
 * Registry for bundled capabilities. Each bundled module calls registerBundled on load
 * so new capabilities can be added without editing this file.
 */
import type { CapabilityDefinition } from "../../schema/index.js";
import type { CapabilityInstance } from "../../types/json.js";
export type BundledCapabilityFactory = (capabilityId: string, def: CapabilityDefinition) => CapabilityInstance;
export declare function registerBundled(capabilityId: string, factory: BundledCapabilityFactory): void;
export declare function getBundledCapability(capabilityId: string, def: CapabilityDefinition): CapabilityInstance | undefined;
export declare function getBundledIds(): Set<string>;
//# sourceMappingURL=registry.d.ts.map