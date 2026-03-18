import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled ImageGenerator capability. Input: { prompt, batch_size?, style? }. Output: { urls: string[] } or { ok: false, error }.
 * POST to config.endpoint with JSON body; expects response.images or response.urls. Auth: config.auth.strategy or legacy config.api_key.
 */
export declare function createImageGeneratorInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=image_generator.d.ts.map