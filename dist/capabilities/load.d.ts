import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { type CapabilityResolver } from "./default-resolvers.js";
export type { CapabilityResolver } from "./default-resolvers.js";
export interface LoadCapabilitiesOptions {
    resolvers?: CapabilityResolver[];
    /** When set, capability source paths must be under this directory. Defaults to process.cwd(). */
    allowedSourceRoot?: string;
}
/**
 * Build a map of capability id -> CapabilityInstance from resolved org config.
 * Uses the given resolvers in order; first resolver that returns an instance wins.
 * When resolvers is omitted, uses default (source when set, then bundled, skill, inline-tool).
 * Capabilities with source are loaded via dynamic import; path must be under allowedSourceRoot or cwd.
 */
export declare function loadCapabilities(config: OrgConfig, options?: LoadCapabilitiesOptions | CapabilityResolver[]): Promise<Map<string, CapabilityInstance>>;
//# sourceMappingURL=load.d.ts.map