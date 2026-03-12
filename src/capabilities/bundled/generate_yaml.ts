import type { CapabilityInstance, CapabilityInput, CapabilityOutput } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
import type { RunContext } from "../../runtime/run-context.js";
import { getProviderService } from "../../providers/registry.js";
import { promptGenerator } from "../../build/prompts.js";

function toStringList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === "string" ? x : String(x)));
  }
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Bundled generate_yaml capability (Generator). Input: { description, prd, existing_capabilities? }.
 * Output: { yaml } or { ok: false, error }. Uses runContext.agentLlm.
 */
export function createGenerateYamlInstance(
  _capabilityId: string,
  _def: CapabilityDefinition
): CapabilityInstance {
  return {
    async execute(
      input: CapabilityInput,
      runContext?: RunContext
    ): Promise<CapabilityOutput> {
      const description = typeof input.description === "string" ? input.description : "";
      const prd = typeof input.prd === "string" ? input.prd : "";
      if (!description || !prd) {
        return { ok: false, error: "Missing description or prd" };
      }
      const existingCapabilities = toStringList(input.existing_capabilities);
      const agentLlm = runContext?.agentLlm;
      const service = getProviderService(agentLlm?.provider ?? "", agentLlm?.apiKey);
      if (!service) {
        return {
          ok: false,
          error: "Generator requires runContext.agentLlm (provider with API key).",
        };
      }
      const prompt = promptGenerator(description, prd, existingCapabilities);
      const result = await service.complete(prompt, { max_tokens: 4000 });
      if (!result || ("ok" in result && result.ok === false)) {
        return {
          ok: false,
          error: "ok" in result && result.ok === false ? result.error : "Generator failed",
        };
      }
      const yaml = ("text" in result ? result.text : "").trim();
      if (!yaml) {
        return { ok: false, error: "Generator returned empty response." };
      }
      return { yaml };
    },
  };
}
