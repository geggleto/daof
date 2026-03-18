import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled SentimentAnalyzer capability. Input: { text }. Output: { score, category } or { ok: false, error }.
 * POST to config.endpoint; expects response.score (number) and response.category. Auth: config.auth.strategy or legacy config.api_key.
 */
export declare function createSentimentAnalyzerInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=sentiment_analyzer.d.ts.map