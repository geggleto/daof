const DEFAULT_HEADER = "X-API-Key";
/**
 * API-Key header strategy. Config: { api_key: string, header?: string }. Returns [header]: <api_key>.
 */
export const apiKeyStrategy = {
    getHeaders(config) {
        const apiKey = config.api_key;
        if (typeof apiKey !== "string" || !apiKey)
            return {};
        const header = typeof config.header === "string" && config.header ? config.header : DEFAULT_HEADER;
        return { [header]: apiKey };
    },
};
//# sourceMappingURL=api_key.js.map