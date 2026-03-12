import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { registerBundled } from "./registry.js";

/**
 * Bundled WebhookNotifier capability. Input: { url, message }. Output: { ok: true } or { ok: false, error }.
 * HTTP POST to url with body { message }. Optional auth via config.auth or config.api_key. No persistence.
 */
export function createWebhookNotifierInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const url = typeof input.url === "string" ? input.url : "";
      const message = typeof input.message === "string" ? input.message : String(input.message ?? "");
      if (!url) {
        return { ok: false, error: "Missing url" };
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getAuthHeadersFromCapabilityConfig(def.config),
      };
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ message }),
        });
        if (!res.ok) {
          const text = await res.text();
          return { ok: false, error: text || `HTTP ${res.status}` };
        }
        return { ok: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
registerBundled("webhook_notifier", createWebhookNotifierInstance);
