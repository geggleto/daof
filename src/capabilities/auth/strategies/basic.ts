import type { AuthStrategy } from "../types.js";
import type { JsonValue } from "../../../types/json.js";

/**
 * Basic auth strategy. Config: { username: string, password: string }. Returns Authorization: Basic <base64>.
 */
export const basicStrategy: AuthStrategy = {
  getHeaders(config: Record<string, JsonValue>): Record<string, string> {
    const username = config.username;
    const password = config.password;
    if (typeof username !== "string" || typeof password !== "string") return {};
    const encoded = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    return { Authorization: `Basic ${encoded}` };
  },
};
