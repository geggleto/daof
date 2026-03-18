import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { registerBundled } from "./registry.js";
function getEndpoint(def) {
    const c = def.config;
    if (c && typeof c === "object" && "endpoint" in c && typeof c.endpoint === "string") {
        return c.endpoint;
    }
    return undefined;
}
const CATEGORIES = ["positive", "neutral", "negative"];
function isCategory(s) {
    return CATEGORIES.includes(s);
}
/**
 * Bundled SentimentAnalyzer capability. Input: { text }. Output: { score, category } or { ok: false, error }.
 * POST to config.endpoint; expects response.score (number) and response.category. Auth: config.auth.strategy or legacy config.api_key.
 */
export function createSentimentAnalyzerInstance(_capabilityId, def) {
    const endpoint = getEndpoint(def);
    return {
        async execute(input, _runContext) {
            if (!endpoint) {
                return { ok: false, error: "Missing config.endpoint" };
            }
            const text = typeof input.text === "string" ? input.text : "";
            const headers = {
                "Content-Type": "application/json",
                ...getAuthHeadersFromCapabilityConfig(def.config),
            };
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ text }),
                });
                const data = (await res.json());
                if (!res.ok) {
                    const msg = typeof data?.error === "string" ? data.error : res.statusText;
                    return { ok: false, error: msg };
                }
                const score = typeof data.score === "number" ? data.score : 0;
                const cat = typeof data.category === "string" && isCategory(data.category) ? data.category : "neutral";
                return { score, category: cat };
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return { ok: false, error };
            }
        },
    };
}
registerBundled("sentiment_analyzer", createSentimentAnalyzerInstance);
//# sourceMappingURL=sentiment_analyzer.js.map