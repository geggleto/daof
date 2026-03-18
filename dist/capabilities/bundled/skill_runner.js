import { getAuthHeadersFromCapabilityConfig } from "../auth/registry.js";
import { getProviderService } from "../../providers/registry.js";
const TEMPLATE_REGEX = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;
function getAtPath(obj, path) {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== "object" || Array.isArray(current)) {
            return undefined;
        }
        current = current[part];
    }
    return current;
}
function resolvePromptTemplate(template, input) {
    const inputObj = input;
    return template.replace(TEMPLATE_REGEX, (_, path) => {
        const value = getAtPath(inputObj, path);
        if (value === undefined || value === null)
            return "";
        return String(value);
    });
}
function getEndpoint(def) {
    const c = def.config;
    if (c && typeof c === "object" && "endpoint" in c && typeof c.endpoint === "string") {
        return c.endpoint;
    }
    return undefined;
}
/**
 * Skill capability: uses def.prompt as a template ({{ key }} or {{ key.nested }} from input),
 * optionally calls an LLM at config.endpoint (same pattern as text_generator), and can invoke
 * other capabilities via runContext.invokeCapability when depends_on is set.
 */
export function createSkillRunnerInstance(_capabilityId, def) {
    const endpoint = getEndpoint(def);
    const promptTemplate = typeof def.prompt === "string" ? def.prompt : "";
    return {
        async execute(input, runContext) {
            const reserved = {};
            if (runContext?.stepId != null)
                reserved.step_id = runContext.stepId;
            const runId = runContext?.runId ?? runContext?.ticket?.id;
            if (runId != null)
                reserved.run_id = runId;
            if (runContext?.agentId != null)
                reserved.agent_id = runContext.agentId;
            const effectiveInput = { ...input, ...reserved };
            const renderedPrompt = resolvePromptTemplate(promptTemplate, effectiveInput);
            if (endpoint) {
                const headers = {
                    "Content-Type": "application/json",
                    ...getAuthHeadersFromCapabilityConfig(def.config),
                };
                try {
                    const res = await fetch(endpoint, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ prompt: renderedPrompt }),
                    });
                    const data = (await res.json());
                    if (!res.ok) {
                        const msg = typeof data?.error === "string" ? data.error : res.statusText;
                        return { ok: false, error: msg };
                    }
                    let text = "";
                    if (typeof data.text === "string") {
                        text = data.text;
                    }
                    else if (Array.isArray(data.choices) && data.choices[0] && typeof data.choices[0].text === "string") {
                        text = data.choices[0].text;
                    }
                    return { text };
                }
                catch (err) {
                    const error = err instanceof Error ? err.message : String(err);
                    return { ok: false, error };
                }
            }
            const agentLlm = runContext?.agentLlm;
            const providerId = agentLlm?.provider;
            const apiKey = agentLlm?.apiKey;
            const service = getProviderService(providerId ?? "", apiKey);
            if (!service) {
                // No endpoint and no LLM: return rendered template only (e.g. for tests or template-only skills).
                return { text: renderedPrompt };
            }
            return service.complete(renderedPrompt, {
                model: agentLlm?.model ?? "auto",
            });
        },
    };
}
//# sourceMappingURL=skill_runner.js.map