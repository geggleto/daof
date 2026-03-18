/**
 * Basic auth strategy. Config: { username: string, password: string }. Returns Authorization: Basic <base64>.
 */
export const basicStrategy = {
    getHeaders(config) {
        const username = config.username;
        const password = config.password;
        if (typeof username !== "string" || typeof password !== "string")
            return {};
        const encoded = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
        return { Authorization: `Basic ${encoded}` };
    },
};
//# sourceMappingURL=basic.js.map