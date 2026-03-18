const ENV_REF_REGEX = /^env\(([A-Za-z_][A-Za-z0-9_]*)\)$/;
/**
 * Replace a single string value if it matches env(VAR_NAME). Returns process.env value or original.
 */
function resolveEnvString(value) {
    const match = value.trim().match(ENV_REF_REGEX);
    if (!match)
        return value;
    const envName = match[1];
    const resolved = process.env[envName];
    return resolved !== undefined ? resolved : value;
}
/**
 * Recursively walk a JsonValue and replace every string that matches env(VAR) with process.env[VAR].
 */
function resolveEnvInJsonValue(value) {
    if (typeof value === "string") {
        return resolveEnvString(value);
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => resolveEnvInJsonValue(item));
    }
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
        obj[k] = resolveEnvInJsonValue(v);
    }
    return obj;
}
/**
 * Return a copy of the org config with all env(VAR_NAME) string values replaced by process.env[VAR_NAME].
 * Same shape as OrgConfig; no mutation of input.
 */
export function resolveEnv(config) {
    return resolveEnvInJsonValue(config);
}
//# sourceMappingURL=resolve-env.js.map