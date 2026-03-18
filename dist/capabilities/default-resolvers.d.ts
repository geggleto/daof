import type { CapabilityDefinition } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
export type CapabilityResolver = (id: string, def: CapabilityDefinition) => CapabilityInstance | undefined;
export type CapabilityTypeResolver = (id: string, def: CapabilityDefinition) => CapabilityInstance | undefined;
/**
 * Register a resolver for a capability definition type (e.g. "skill", "hybrid").
 * New types can be added without editing the default resolver chain.
 */
export declare function registerCapabilityTypeResolver(type: string, resolver: CapabilityTypeResolver): void;
/**
 * Default resolvers: try bundled, then type-based (e.g. skill), then inline-tool as catch-all.
 * Used when loadCapabilities is called without custom resolvers.
 */
export declare function getDefaultCapabilityResolvers(): CapabilityResolver[];
//# sourceMappingURL=default-resolvers.d.ts.map