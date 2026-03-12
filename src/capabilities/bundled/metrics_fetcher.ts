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
 * Bundled MetricsFetcher capability. Input: { post_id?, ... }. Output: { views?, likes?, ... } or error.
 * When config.endpoint is set, GET to fetch metrics (auth via config.auth or config.api_key); otherwise returns stub { views: 0, likes: 0 }.
 */
export function createMetricsFetcherInstance(
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
        return { views: 0, likes: 0 };
      }

      const postId = typeof input.post_id === "string" ? input.post_id : undefined;
      const headers: Record<string, string> = {
        ...getAuthHeadersFromCapabilityConfig(def.config),
      };

      try {
        const url = postId ? `${endpoint}?post_id=${encodeURIComponent(postId)}` : endpoint;
        const res = await fetch(url, { method: "GET", headers });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : res.statusText;
          return { ok: false, error: msg };
        }
        const views = typeof data.views === "number" ? data.views : typeof data.impressions === "number" ? data.impressions : 0;
        const likes = typeof data.likes === "number" ? data.likes : typeof data.favorite_count === "number" ? data.favorite_count : 0;
        return { views, likes, ...data };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
registerBundled("metrics_fetcher", createMetricsFetcherInstance);
