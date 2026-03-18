import { getProviderService } from "../../providers/registry.js";
import { promptPlanner } from "../../build/prompts.js";
import { registerBundled } from "./registry.js";
/**
 * Bundled produce_prd capability (Planner). Input: { description, existing_capabilities? }.
 * Output: { prd } or { ok: false, error }. Uses runContext.agentLlm.
 */
export function createProducePrdInstance(_capabilityId, _def) {
    return {
        async execute(input, runContext) {
            const description = typeof input.description === "string" ? input.description : "";
            if (!description) {
                return { ok: false, error: "Missing description" };
            }
            const agentLlm = runContext?.agentLlm;
            const service = getProviderService(agentLlm?.provider ?? "", agentLlm?.apiKey);
            if (!service) {
                return {
                    ok: false,
                    error: "Planner requires runContext.agentLlm (provider with API key).",
                };
            }
            const prompt = promptPlanner(description);
            const result = await service.complete(prompt, {
                max_tokens: 1500,
                model: agentLlm?.model ?? "auto",
            });
            if (!result || ("ok" in result && result.ok === false)) {
                return {
                    ok: false,
                    error: "ok" in result && result.ok === false ? result.error : "Planner failed",
                };
            }
            const prd = ("text" in result ? result.text : "").trim();
            if (!prd) {
                return { ok: false, error: "Planner returned empty PRD." };
            }
            return { prd };
        },
    };
}
registerBundled("produce_prd", createProducePrdInstance);
//# sourceMappingURL=produce_prd.js.map