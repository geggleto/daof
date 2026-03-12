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

const CATEGORIES = ["positive", "neutral", "negative"] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(s: string): s is Category {
  return CATEGORIES.includes(s as Category);
}

/**
 * Bundled SentimentAnalyzer capability. Input: { text }. Output: { score, category } or { ok: false, error }.
 * POST to config.endpoint; expects response.score (number) and response.category. Auth: config.auth.strategy or legacy config.api_key.
 */
export function createSentimentAnalyzerInstance(
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
      const text = typeof input.text === "string" ? input.text : "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getAuthHeadersFromCapabilityConfig(def.config),
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ text }),
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : res.statusText;
          return { ok: false, error: msg };
        }
        const score = typeof data.score === "number" ? data.score : 0;
        const cat = typeof data.category === "string" && isCategory(data.category) ? data.category : "neutral";
        return { score, category: cat };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { ok: false, error };
      }
    },
  };
}
registerBundled("sentiment_analyzer", createSentimentAnalyzerInstance);
