import { z } from "zod";
/**
 * Recursive JSON-serializable value. No unknown or any.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | {
    [key: string]: JsonValue;
};
/**
 * Raw result of YAML parse before validation. Same structure as JsonValue.
 */
export type ParsedYaml = JsonValue;
/**
 * Input to a capability execute call (e.g. step params or workflow context).
 */
export type CapabilityInput = Record<string, JsonValue>;
/**
 * Output from a capability execute call.
 */
export type CapabilityOutput = Record<string, JsonValue>;
/**
 * Runnable capability instance. No unknown or any.
 * runContext is optional; when present, capabilities can e.g. publish to backbone.
 */
export interface CapabilityInstance {
    execute(input: CapabilityInput, runContext?: import("../runtime/run-context.js").RunContext): Promise<CapabilityOutput>;
}
/**
 * Zod schema for JsonValue (recursive). Use for config, params, goals objects, rogue_detection, etc.
 */
export declare const JsonValueSchema: z.ZodType<JsonValue>;
//# sourceMappingURL=json.d.ts.map