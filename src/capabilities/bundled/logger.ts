import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import { registerBundled } from "./registry.js";

const LEVELS = ["info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function isLevel(s: string): s is Level {
  return LEVELS.includes(s as Level);
}

/**
 * Bundled Logger capability. Input: { level, message, metadata? }. Output: { ok: true }.
 * Logs to console (console.log / console.warn / console.error). v1: console only.
 */
export function createLoggerInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      _runContext?: import("../../runtime/run-context.js").RunContext
    ): Promise<CapabilityOutput> {
      const level = typeof input.level === "string" && isLevel(input.level) ? input.level : "info";
      const message = typeof input.message === "string" ? input.message : String(input.message ?? "");
      const metadata = input.metadata;
      if (level === "warn") {
        console.warn(message, metadata !== undefined ? metadata : "");
      } else if (level === "error") {
        console.error(message, metadata !== undefined ? metadata : "");
      } else {
        console.log(message, metadata !== undefined ? metadata : "");
      }
      return { ok: true };
    },
  };
}
registerBundled("logger", createLoggerInstance);
