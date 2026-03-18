import type { JsonValue } from "../../types/json.js";
/**
 * Auth strategy (adapter) for outbound HTTP requests.
 * Each implementation reads a known config shape and returns headers only; do not log or expose raw secrets.
 */
export interface AuthStrategy {
    /** Return headers to merge into outbound HTTP requests. */
    getHeaders(config: Record<string, JsonValue>): Record<string, string>;
}
//# sourceMappingURL=types.d.ts.map