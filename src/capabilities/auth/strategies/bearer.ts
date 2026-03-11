import type { AuthStrategy } from "../types.js";
import type { JsonValue } from "../../../types/json.js";

/**
 * Bearer token strategy. Config: { token: string }. Returns Authorization: Bearer <token>.
 */
export const bearerStrategy: AuthStrategy = {
  getHeaders(config: Record<string, JsonValue>): Record<string, string> {
    const token = config.token;
    if (typeof token !== "string" || !token) return {};
    return { Authorization: `Bearer ${token}` };
  },
};
