import type { OrgConfig } from "../schema/index.js";
import type { CapabilityInstance } from "../types/json.js";
import { createInlineToolInstance } from "./adapters/inline-tool.js";
import { getBundledCapability } from "./bundled/index.js";
import { createSkillRunnerInstance } from "./bundled/skill_runner.js";

/**
 * Build a map of capability id -> CapabilityInstance from resolved org config.
 * Bundled capabilities (logger, event_emitter, webhook_notifier, etc.) use their dedicated implementations;
 * type "skill" uses the skill runner (prompt template, optional LLM at config.endpoint);
 * others (no source) use the inline-tool adapter. Capabilities with source are not yet supported.
 */
export function loadCapabilities(config: OrgConfig): Map<string, CapabilityInstance> {
  const map = new Map<string, CapabilityInstance>();
  for (const [id, def] of Object.entries(config.capabilities)) {
    if (def.source) {
      throw new Error(
        `Capability "${id}" has source "${def.source}"; repo-pulled capabilities are not yet supported.`
      );
    }
    const bundled = getBundledCapability(id, def);
    if (bundled) {
      map.set(id, bundled);
    } else if (def.type === "skill") {
      map.set(id, createSkillRunnerInstance(id, def));
    } else {
      map.set(id, createInlineToolInstance(id, def));
    }
  }
  return map;
}
