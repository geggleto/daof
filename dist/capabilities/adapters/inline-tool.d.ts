import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Build a CapabilityInstance for an inline tool (no source). If config has endpoint, use HTTP POST;
 * otherwise return a stub that echoes input.
 */
export declare function createInlineToolInstance(capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=inline-tool.d.ts.map