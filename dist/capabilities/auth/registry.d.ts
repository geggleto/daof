import type { JsonValue } from "../../types/json.js";
import type { AuthStrategy } from "./types.js";
/**
 * Look up an auth strategy by name.
 */
export declare function getAuthStrategy(name: string): AuthStrategy | undefined;
/**
 * Get headers for the given strategy name and config. Returns empty object if strategy is missing or config is invalid.
 */
export declare function getAuthHeaders(strategyName: string, config: Record<string, JsonValue>): Record<string, string>;
/**
 * Get auth headers from full capability config. Supports Option A (config.auth.strategy + config.auth)
 * and legacy (top-level config.api_key as Bearer). Returns empty object when no auth config.
 */
export declare function getAuthHeadersFromCapabilityConfig(config: Record<string, JsonValue> | undefined): Record<string, string>;
//# sourceMappingURL=registry.d.ts.map