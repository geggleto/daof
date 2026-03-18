import { bearerStrategy } from "./strategies/bearer.js";
import { apiKeyStrategy } from "./strategies/api_key.js";
import { basicStrategy } from "./strategies/basic.js";
const strategies = new Map([
    ["bearer", bearerStrategy],
    ["api_key", apiKeyStrategy],
    ["basic", basicStrategy],
]);
/**
 * Look up an auth strategy by name.
 */
export function getAuthStrategy(name) {
    return strategies.get(name);
}
/**
 * Get headers for the given strategy name and config. Returns empty object if strategy is missing or config is invalid.
 */
export function getAuthHeaders(strategyName, config) {
    const strategy = strategies.get(strategyName);
    if (!strategy)
        return {};
    return strategy.getHeaders(config);
}
/**
 * Get auth headers from full capability config. Supports Option A (config.auth.strategy + config.auth)
 * and legacy (top-level config.api_key as Bearer). Returns empty object when no auth config.
 */
export function getAuthHeadersFromCapabilityConfig(config) {
    if (!config || typeof config !== "object")
        return {};
    const auth = config.auth;
    if (auth && typeof auth === "object" && !Array.isArray(auth)) {
        const strategyName = auth.strategy;
        if (typeof strategyName === "string") {
            return getAuthHeaders(strategyName, auth);
        }
    }
    if (typeof config.api_key === "string" && config.api_key) {
        return getAuthHeaders("bearer", { token: config.api_key });
    }
    return {};
}
//# sourceMappingURL=registry.js.map