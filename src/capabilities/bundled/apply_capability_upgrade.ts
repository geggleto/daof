import type { CapabilityInstance, CapabilityInput, CapabilityOutput, JsonValue } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import { loadYaml, validate, writeOrgFile } from "../../parser/index.js";
import { randomUUID } from "node:crypto";

// ... recommendation types and parsing ...

export function createApplyCapabilityUpgradeInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      runContext?: RunContext
    ): Promise<CapabilityOutput> {
      // 1. Get recommendations from input or invoke recommend_upgrades
      // 2. Categorize: add_capability → build.requested event
      //                update_config / model_upgrade → direct YAML patch
      // 3. Emit build.requested via event_emitter for new capabilities
      // 4. Load, patch, validate, write org for config/model changes
      // 5. Return summary with applied count and errors
      return { ok: true };
    },
  };
}