const TEMPLATE_REGEX = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;
function getAtPath(obj, path) {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== "object" || Array.isArray(current)) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
/**
 * Resolve {{ agentId.key }} (or agentId.key1.key2) in a string against WorkflowContext.
 * Replaces each match with the value at context[agentId][key...]; if missing, leaves placeholder or uses empty string.
 */
export function resolveTemplate(context, str) {
    return str.replace(TEMPLATE_REGEX, (_, path) => {
        const [agentId, ...rest] = path.split(".");
        const output = context[agentId];
        if (!output)
            return "";
        const fullPath = rest.length > 0 ? rest.join(".") : "";
        const value = fullPath ? getAtPath(output, fullPath) : output;
        if (value === undefined || value === null)
            return "";
        return String(value);
    });
}
function resolveValue(context, value) {
    if (typeof value === "string")
        return resolveTemplate(context, value);
    if (Array.isArray(value))
        return value.map((item) => resolveValue(context, item));
    if (value !== null && typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value))
            out[k] = resolveValue(context, v);
        return out;
    }
    return value;
}
/**
 * Resolve all {{ id.path }} strings in params (recursively).
 */
export function resolveParams(context, params) {
    return resolveValue(context, params);
}
/**
 * Evaluate condition string against context. Splits on "&&", resolves each path (e.g. {{ visual_qa.verdict }}),
 * and returns true only if all resolved values are truthy.
 */
export function evaluateCondition(context, condition) {
    const trimmed = condition.trim();
    if (!trimmed)
        return true;
    const parts = trimmed.split(/\s*&&\s*/).map((p) => p.trim());
    for (const part of parts) {
        const match = part.match(/\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/);
        if (!match)
            return false;
        const path = match[1];
        const [agentId, ...rest] = path.split(".");
        const output = context[agentId];
        if (!output)
            return false;
        const value = rest.length > 0 ? getAtPath(output, rest.join(".")) : output;
        if (value === undefined || value === null)
            return false;
        if (value === false || value === 0 || value === "")
            return false;
    }
    return true;
}
//# sourceMappingURL=context.js.map