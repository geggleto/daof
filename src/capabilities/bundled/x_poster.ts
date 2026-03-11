import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";

function getEndpoint(def: CapabilityDefinition): string | undefined {
  const c = def.config;
  if (c && typeof c === "object" && "endpoint" in c && typeof (c as Record<string, unknown>).endpoint === "string") {
    return (c as Record<string, string>).endpoint;
  }
  return undefined;
}

/**
 * Bundled XPoster capability. Input: { content, media_urls? }. Output: { post_id } or { ok: false, error }.
 * When config.endpoint and auth (config.auth or config.api_key) are set, POST to endpoint; otherwise returns stub { post_id: "stub" }.
 * Full X/Twitter API OAuth setup is required for real posts.
 */
export function createXPosterInstance(
  _capabilityId: string,
  def: CapabilityDefinition
): CapabilityInstance {
  const endpoint = getEndpoint(def);

  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const content = typeof input.content === "string" ? input.content : "";
      if (!content) {
        return { ok: false, error: "Missing content" };
      }

      const authHeaders = getAuthHeadersFromCapabilityConfig(def.config);
      if (!endpoint || Object.keys(authHeaders).length === 0) {
        return { post_id: "stub" };
      }

      const body: Record<string, unknown> = { text: content };
      if (Array.isArray(input.media_urls)) {
        body.media_ids = input.media_urls;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...authHeaders,
      };

      try {
        const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : res.statusText;
          return { ok: false, error: msg };
        }
        const dataId = data.data as Record<string, string> | undefined;
        const postId = typeof data.id === "string" ? data.id : typeof dataId?.id === "string" ? dataId.id : "stub";
        return { post_id: postId };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
