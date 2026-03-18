import { registerBundled } from "./registry.js";
const LEVELS = ["info", "warn", "error"];
function isLevel(s) {
    return LEVELS.includes(s);
}
/**
 * Bundled Logger capability. Input: { level, message, metadata? }. Output: { ok: true }.
 * Logs to console (console.log / console.warn / console.error). v1: console only.
 */
export function createLoggerInstance(_capabilityId, _def) {
    return {
        async execute(input, _runContext) {
            const level = typeof input.level === "string" && isLevel(input.level) ? input.level : "info";
            const message = typeof input.message === "string" ? input.message : String(input.message ?? "");
            const metadata = input.metadata;
            if (level === "warn") {
                console.warn(message, metadata !== undefined ? metadata : "");
            }
            else if (level === "error") {
                console.error(message, metadata !== undefined ? metadata : "");
            }
            else {
                console.log(message, metadata !== undefined ? metadata : "");
            }
            return { ok: true };
        },
    };
}
registerBundled("logger", createLoggerInstance);
//# sourceMappingURL=logger.js.map