function hasStringEndpoint(config) {
    return (config !== undefined &&
        typeof config === "object" &&
        config !== null &&
        "endpoint" in config &&
        typeof config.endpoint === "string");
}
/**
 * Build a CapabilityInstance for an inline tool (no source). If config has endpoint, use HTTP POST;
 * otherwise return a stub that echoes input.
 */
export function createInlineToolInstance(capabilityId, def) {
    const config = def.config;
    if (hasStringEndpoint(config)) {
        const endpoint = config.endpoint;
        const apiKey = "api_key" in config && typeof config.api_key === "string" ? config.api_key : undefined;
        return {
            async execute(input, _runContext) {
                const headers = {
                    "Content-Type": "application/json",
                };
                if (apiKey)
                    headers["Authorization"] = `Bearer ${apiKey}`;
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(input),
                });
                const text = await res.text();
                if (!res.ok) {
                    return { error: text, status: res.status };
                }
                try {
                    const data = JSON.parse(text);
                    return data;
                }
                catch {
                    return { body: text };
                }
            },
        };
    }
    return {
        async execute(input, _runContext) {
            return { ok: true, capabilityId, input };
        },
    };
}
//# sourceMappingURL=inline-tool.js.map