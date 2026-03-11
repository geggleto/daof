import type { CapabilityInput, CapabilityOutput, JsonValue } from "../types/json.js";
import type { WorkflowContext } from "./types.js";

const TEMPLATE_REGEX = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

function getAtPath(obj: CapabilityOutput, path: string): JsonValue | undefined {
  const parts = path.split(".");
  let current: JsonValue = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, JsonValue>)[part];
  }
  return current;
}

/**
 * Resolve {{ agentId.key }} (or agentId.key1.key2) in a string against WorkflowContext.
 * Replaces each match with the value at context[agentId][key...]; if missing, leaves placeholder or uses empty string.
 */
export function resolveTemplate(context: WorkflowContext, str: string): string {
  return str.replace(TEMPLATE_REGEX, (_, path: string) => {
    const [agentId, ...rest] = path.split(".");
    const output = context[agentId];
    if (!output) return "";
    const fullPath = rest.length > 0 ? rest.join(".") : "";
    const value = fullPath ? getAtPath(output, fullPath) : output;
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function resolveValue(context: WorkflowContext, value: JsonValue): JsonValue {
  if (typeof value === "string") return resolveTemplate(context, value);
  if (Array.isArray(value)) return value.map((item) => resolveValue(context, item));
  if (value !== null && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveValue(context, v);
    return out;
  }
  return value;
}

/**
 * Resolve all {{ id.path }} strings in params (recursively).
 */
export function resolveParams(context: WorkflowContext, params: Record<string, JsonValue>): CapabilityInput {
  return resolveValue(context, params) as CapabilityInput;
}

/**
 * Evaluate condition string against context. Splits on "&&", resolves each path (e.g. {{ visual_qa.verdict }}),
 * and returns true only if all resolved values are truthy.
 */
export function evaluateCondition(context: WorkflowContext, condition: string): boolean {
  const trimmed = condition.trim();
  if (!trimmed) return true;
  const parts = trimmed.split(/\s*&&\s*/).map((p) => p.trim());
  for (const part of parts) {
    const match = part.match(/\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/);
    if (!match) return false;
    const path = match[1];
    const [agentId, ...rest] = path.split(".");
    const output = context[agentId];
    if (!output) return false;
    const value = rest.length > 0 ? getAtPath(output, rest.join(".")) : output;
    if (value === undefined || value === null) return false;
    if (value === false || value === 0 || value === "") return false;
  }
  return true;
}
