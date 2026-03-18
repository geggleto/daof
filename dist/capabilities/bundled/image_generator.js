import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { registerBundled } from "./registry.js";
function getEndpoint(def) {
    const c = def.config;
    if (c && typeof c === "object" && "endpoint" in c && typeof c.endpoint === "string") {
        return c.endpoint;
    }
    return undefined;
}
/**
 * Bundled ImageGenerator capability. Input: { prompt, batch_size?, style? }. Output: { urls: string[] } or { ok: false, error }.
 * POST to config.endpoint with JSON body; expects response.images or response.urls. Auth: config.auth.strategy or legacy config.api_key.
 */
export function createImageGeneratorInstance(_capabilityId, def) {
    const endpoint = getEndpoint(def);
    return {
        async execute(input, _runContext) {
            if (!endpoint) {
                return { ok: false, error: "Missing config.endpoint" };
            }
            const prompt = typeof input.prompt === "string" ? input.prompt : "";
            const body = { prompt };
            if (typeof input.batch_size === "number")
                body.batch_size = input.batch_size;
            if (typeof input.style === "string")
                body.style = input.style;
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
                const urls = Array.isArray(data.urls) ? data.urls : Array.isArray(data.images) ? data.images : [];
                const strings = urls.filter((u) => typeof u === "string");
                return { urls: strings };
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return { ok: false, error };
            }
        },
    };
}
registerBundled("image_generator", createImageGeneratorInstance);
//# sourceMappingURL=image_generator.js.map