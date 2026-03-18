/**
 * Bearer token strategy. Config: { token: string }. Returns Authorization: Bearer <token>.
 */
export const bearerStrategy = {
    getHeaders(config) {
        const token = config.token;
        if (typeof token !== "string" || !token)
            return {};
        return { Authorization: `Bearer ${token}` };
    },
};
//# sourceMappingURL=bearer.js.map