import type { CapabilityInput, JsonValue } from "../types/json.js";
import type { WorkflowContext } from "./types.js";
/**
 * Resolve {{ agentId.key }} (or agentId.key1.key2) in a string against WorkflowContext.
 * Replaces each match with the value at context[agentId][key...]; if missing, leaves placeholder or uses empty string.
 */
export declare function resolveTemplate(context: WorkflowContext, str: string): string;
/**
 * Resolve all {{ id.path }} strings in params (recursively).
 */
export declare function resolveParams(context: WorkflowContext, params: Record<string, JsonValue>): CapabilityInput;
/**
 * Evaluate condition string against context. Splits on "&&", resolves each path (e.g. {{ visual_qa.verdict }}),
 * and returns true only if all resolved values are truthy.
 */
export declare function evaluateCondition(context: WorkflowContext, condition: string): boolean;
//# sourceMappingURL=context.d.ts.map