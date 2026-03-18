import { getProviderService } from "../../providers/registry.js";
import { promptVerifier } from "../../build/prompts.js";
import { registerBundled } from "./registry.js";
/**
 * Bundled verify_build capability (Verifier). Input: { prd, summary }.
 * Output: { pass: boolean } or { ok: false, error }. Uses runContext.agentLlm.
 */
export function createVerifyBuildInstance(_capabilityId, _def) {
    return {
        async execute(input, runContext) {
            const prd = typeof input.prd === "string" ? input.prd : "";
            const summary = typeof input.summary === "string" ? input.summary : "";
            if (!prd || !summary) {
                return { ok: false, error: "Missing prd or summary" };
            }
            const agentLlm = runContext?.agentLlm;
            const service = getProviderService(agentLlm?.provider ?? "", agentLlm?.apiKey);
            if (!service) {
                return {
                    ok: false,
                    error: "Verifier requires runContext.agentLlm (provider with API key).",
                };
            }
            const prompt = promptVerifier(prd, summary);
            const result = await service.complete(prompt, {
                max_tokens: 50,
                model: agentLlm?.model ?? "auto",
            });
            if (!result || ("ok" in result && result.ok === false)) {
                return {
                    ok: false,
                    error: "ok" in result && result.ok === false ? result.error : "Verifier failed",
                };
            }
            const text = ("text" in result ? result.text : "").trim().toUpperCase();
            const pass = text.includes("PASS");
            return { pass };
        },
    };
}
registerBundled("verify_build", createVerifyBuildInstance);
//# sourceMappingURL=verify_build.js.map