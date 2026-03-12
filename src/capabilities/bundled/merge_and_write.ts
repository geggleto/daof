import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import { loadYaml, validate, parseYamlString, writeOrgFile } from "../../parser/index.js";
import { extractYamlFromMarkdown, extractGenerated, mergeIntoConfig } from "../../build/merge.js";
import { registerBundled } from "./registry.js";

/**
 * Bundled merge_and_write capability. Input: { org_path, generated_yaml }.
 * Output: { summary, added_count } or { ok: false, error }. No LLM; reads org, merges, validates, writes.
 */
export function createMergeAndWriteInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      _runContext?: RunContext
    ): Promise<CapabilityOutput> {
      const orgPath = typeof input.org_path === "string" ? input.org_path : "";
      const generatedYaml = typeof input.generated_yaml === "string" ? input.generated_yaml : "";
      if (!orgPath || !generatedYaml) {
        return { ok: false, error: "Missing org_path or generated_yaml" };
      }
      let config;
      try {
        const raw = loadYaml(orgPath);
        config = validate(raw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Failed to load/validate org: ${msg}` };
      }
      const stripped = extractYamlFromMarkdown(generatedYaml);
      let parsed;
      try {
        parsed = parseYamlString(stripped);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Failed to parse generated YAML: ${msg}` };
      }
      const generated = extractGenerated(parsed);
      if (
        Object.keys(generated.capabilities).length === 0 &&
        Object.keys(generated.agents).length === 0 &&
        Object.keys(generated.workflows).length === 0
      ) {
        return { ok: false, error: "Generator returned no capabilities, agents, or workflows." };
      }
      const merged = mergeIntoConfig(config, generated);
      try {
        validate(merged as unknown as import("../../types/json.js").ParsedYaml);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Validation failed after merge: ${msg}` };
      }
      try {
        writeOrgFile(orgPath, merged);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: `Failed to write org file: ${msg}` };
      }
      const addedCount =
        Object.keys(generated.capabilities).length +
        Object.keys(generated.agents).length +
        Object.keys(generated.workflows).length;
      const summary =
        `Capabilities: ${Object.keys(generated.capabilities).join(", ") || "none"}. ` +
        `Agents: ${Object.keys(generated.agents).join(", ") || "none"}. ` +
        `Workflows: ${Object.keys(generated.workflows).join(", ") || "none"}.`;
      return { summary, added_count: addedCount };
    },
  };
}
registerBundled("merge_and_write", createMergeAndWriteInstance);
