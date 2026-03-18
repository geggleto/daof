import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled TextGenerator capability. Input: { prompt, max_tokens? }. Output: { text: string } or { ok: false, error }.
 * When config.endpoint is set: POST to that endpoint; parses response.text or response.choices[0].text. Auth: config.auth.strategy or legacy config.api_key.
 * When config.endpoint is not set: uses runContext.agentLlm (provider + apiKey) to get a provider service via getProviderService and calls service.complete(prompt, { max_tokens }). Provider execution (e.g. Cursor CLI) is behind the provider service layer.
 */
export declare function createTextGeneratorInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=text_generator.d.ts.map