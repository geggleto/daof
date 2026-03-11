import type { JsonValue } from "../../types/json.js";
import type { AuthStrategy } from "./types.js";
import { bearerStrategy } from "./strategies/bearer.js";
import { apiKeyStrategy } from "./strategies/api_key.js";
import { basicStrategy } from "./strategies/basic.js";

const strategies = new Map<string, AuthStrategy>([
  ["bearer", bearerStrategy],
  ["api_key", apiKeyStrategy],
  ["basic", basicStrategy],
]);

/**
 * Look up an auth strategy by name.
 */
export function getAuthStrategy(name: string): AuthStrategy | undefined {
  return strategies.get(name);
}

/**
 * Get headers for the given strategy name and config. Returns empty object if strategy is missing or config is invalid.
 */
export function getAuthHeaders(
  strategyName: string,
  config: Record<string, JsonValue>
): Record<string, string> {
  const strategy = strategies.get(strategyName);
  if (!strategy) return {};
  return strategy.getHeaders(config);
}

/**
 * Get auth headers from full capability config. Supports Option A (config.auth.strategy + config.auth)
 * and legacy (top-level config.api_key as Bearer). Returns empty object when no auth config.
 */
export function getAuthHeadersFromCapabilityConfig(config: Record<string, JsonValue> | undefined): Record<string, string> {
  if (!config || typeof config !== "object") return {};
  const auth = config.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const strategyName = (auth as Record<string, JsonValue>).strategy;
    if (typeof strategyName === "string") {
      return getAuthHeaders(strategyName, auth as Record<string, JsonValue>);
    }
  }
  if (typeof config.api_key === "string" && config.api_key) {
    return getAuthHeaders("bearer", { token: config.api_key });
  }
  return {};
}
