import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Skill capability: uses def.prompt as a template ({{ key }} or {{ key.nested }} from input),
 * optionally calls an LLM at config.endpoint (same pattern as text_generator), and can invoke
 * other capabilities via runContext.invokeCapability when depends_on is set.
 */
export declare function createSkillRunnerInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=skill_runner.d.ts.map