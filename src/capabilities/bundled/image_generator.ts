import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { registerBundled } from "./registry.js";

function getEndpoint(def: CapabilityDefinition): string | undefined {
  const c = def.config;
  if (c && typeof c === "object" && "endpoint" in c && typeof (c as Record<string, unknown>).endpoint === "string") {
    return (c as Record<string, string>).endpoint;
  }
  return undefined;
}

/**
 * Bundled ImageGenerator capability. Input: { prompt, batch_size?, style? }. Output: { urls: string[] } or { ok: false, error }.
 * POST to config.endpoint with JSON body; expects response.images or response.urls. Auth: config.auth.strategy or legacy config.api_key.
 */
export function createImageGeneratorInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const endpoint = getEndpoint(def);

  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      if (!endpoint) {
        return { ok: false, error: "Missing config.endpoint" };
      }
      const prompt = typeof input.prompt === "string" ? input.prompt : "";
      const body: Record<string, unknown> = { prompt };
      if (typeof input.batch_size === "number") body.batch_size = input.batch_size;
      if (typeof input.style === "string") body.style = input.style;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getAuthHeadersFromCapabilityConfig(def.config),
      };

      try {
        const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : res.statusText;
          return { ok: false, error: msg };
        }
        const urls = Array.isArray(data.urls) ? data.urls : Array.isArray(data.images) ? data.images : [];
        const strings = urls.filter((u): u is string => typeof u === "string");
        return { urls: strings };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
registerBundled("image_generator", createImageGeneratorInstance);
