import { getProviderService } from "../../providers/registry.js";
import { promptSimilarity } from "../../build/prompts.js";
import { extractYamlFromMarkdown } from "../../build/merge.js";
import { registerBundled } from "./registry.js";
/**
 * Bundled verify_similarity capability. Input: { proposed_capabilities, existing_capabilities, proposed_agents, existing_agents } (each a record).
 * Output: { duplicates: SimilarityDuplicate[] } or { ok: false, error }.
 * Uses runContext.agentLlm to call LLM; compares proposed vs proposed and proposed vs existing to find near-duplicates.
 */
export function createVerifySimilarityInstance(_capabilityId, _def) {
    return {
        async execute(input, runContext) {
            const proposedCapabilities = input.proposed_capabilities ?? {};
            const existingCapabilities = input.existing_capabilities ?? {};
            const proposedAgents = input.proposed_agents ?? {};
            const existingAgents = input.existing_agents ?? {};
            const payload = {
                proposed_capabilities: proposedCapabilities,
                existing_capabilities: existingCapabilities,
                proposed_agents: proposedAgents,
                existing_agents: existingAgents,
            };
            const payloadJson = JSON.stringify(payload, null, 2);
            const agentLlm = runContext?.agentLlm;
            const service = getProviderService(agentLlm?.provider ?? "", agentLlm?.apiKey);
            if (!service) {
                return {
                    ok: false,
                    error: "verify_similarity requires runContext.agentLlm (provider with API key).",
                };
            }
            const prompt = promptSimilarity(payloadJson);
            const result = await service.complete(prompt, {
                max_tokens: 1000,
                model: agentLlm?.model ?? "auto",
            });
            if (!result || ("ok" in result && result.ok === false)) {
                return {
                    ok: false,
                    error: "ok" in result && result.ok === false ? result.error : "Similarity check failed",
                };
            }
            const text = ("text" in result ? result.text : "").trim();
            const raw = extractYamlFromMarkdown(text);
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                return {
                    ok: false,
                    error: "Similarity check did not return valid JSON.",
                };
            }
            const duplicates = Array.isArray(parsed.duplicates) ? parsed.duplicates : [];
            return { duplicates: duplicates };
        },
    };
}
registerBundled("verify_similarity", createVerifySimilarityInstance);
//# sourceMappingURL=verify_similarity.js.map