import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled Logger capability. Input: { level, message, metadata? }. Output: { ok: true }.
 * Logs to console (console.log / console.warn / console.error). v1: console only.
 */
export declare function createLoggerInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=logger.d.ts.map