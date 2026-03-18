import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { getProviderService } from "../../providers/registry.js";
import { registerBundled } from "./registry.js";
function getEndpoint(def) {
    const c = def.config;
    if (c && typeof c === "object" && "endpoint" in c && typeof c.endpoint === "string") {
        return c.endpoint;
    }
    return undefined;
}
/**
 * Bundled TextGenerator capability. Input: { prompt, max_tokens? }. Output: { text: string } or { ok: false, error }.
 * When config.endpoint is set: POST to that endpoint; parses response.text or response.choices[0].text. Auth: config.auth.strategy or legacy config.api_key.
 * When config.endpoint is not set: uses runContext.agentLlm (provider + apiKey) to get a provider service via getProviderService and calls service.complete(prompt, { max_tokens }). Provider execution (e.g. Cursor CLI) is behind the provider service layer.
 */
export function createTextGeneratorInstance(_capabilityId, def) {
    const endpoint = getEndpoint(def);
    return {
        async execute(input, runContext) {
            const prompt = typeof input.prompt === "string" ? input.prompt : "";
            const maxTokens = typeof input.max_tokens === "number" ? input.max_tokens : undefined;
            if (endpoint) {
                const body = { prompt };
                if (maxTokens != null)
                    body.max_tokens = maxTokens;
                const headers = {
                    "Content-Type": "application/json",
                    ...getAuthHeadersFromCapabilityConfig(def.config),
                };
                try {
                    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
                    const data = (await res.json());
                    if (!res.ok) {
                        const msg = typeof data?.error === "string" ? data.error : res.statusText;
                        return { ok: false, error: msg };
                    }
                    let text = "";
                    if (typeof data.text === "string") {
                        text = data.text;
                    }
                    else if (Array.isArray(data.choices) && data.choices[0]) {
                        const c = data.choices[0];
                        if (typeof c.text === "string")
                            text = c.text;
                        else if (c.message && typeof c.message.content === "string") {
                            text = c.message.content;
                        }
                    }
                    return { text };
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : String(err);
                    return { ok: false, error };
                }
            }
            const agentLlm = runContext?.agentLlm;
            const providerId = agentLlm?.provider;
            const apiKey = agentLlm?.apiKey;
            const service = getProviderService(providerId ?? "", apiKey);
            if (!service) {
                return { ok: false, error: "Missing config.endpoint and no runContext.agentLlm (provider with API key) available." };
            }
            return service.complete(prompt, {
                max_tokens: maxTokens,
                model: agentLlm?.model ?? "auto",
            });
        },
    };
}
registerBundled("text_generator", createTextGeneratorInstance);
//# sourceMappingURL=text_generator.js.map