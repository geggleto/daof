/**
 * Build flow agents: planner, generator, merge-and-write, verifier (via org-level agents).
 */
import { getProviderApiKey } from "../providers/registry.js";
import { createRunContext } from "../runtime/run-context.js";
/** Run Planner via agent; return prd or throw. */
export async function runPlannerAgent(runtime, description) {
    const planner = runtime.agents.get("planner");
    const runContext = createRunContext(runtime, "produce_prd", { provider: planner.provider, model: planner.model, apiKey: getProviderApiKey(planner.provider) });
    const out = await planner.invoke("produce_prd", { description }, runContext);
    if (out && "ok" in out && out.ok === false) {
        throw new Error(typeof out.error === "string" ? out.error : "Planner failed");
    }
    const prd = typeof out.prd === "string" ? out.prd : "";
    if (!prd)
        throw new Error("Planner returned empty PRD.");
    return prd;
}
/** Run Generator via agent; return yaml text or throw. */
export async function runGeneratorAgent(runtime, description, prd, existingCapabilityIds) {
    const generator = runtime.agents.get("generator");
    const runContext = createRunContext(runtime, "generate_yaml", { provider: generator.provider, model: generator.model, apiKey: getProviderApiKey(generator.provider) });
    const out = await generator.invoke("generate_yaml", { description, prd, existing_capabilities: existingCapabilityIds }, runContext);
    if (out && "ok" in out && out.ok === false) {
        throw new Error(typeof out.error === "string" ? out.error : "Generator failed");
    }
    const yaml = typeof out.yaml === "string" ? out.yaml : "";
    if (!yaml)
        throw new Error("Generator returned empty response.");
    return yaml;
}
/** Run merge_and_write via builder agent; return { summary, added_count } or throw. */
export async function runMergeAndWriteAgent(runtime, orgFilePath, generatedYaml) {
    const builder = runtime.agents.get("builder");
    const runContext = createRunContext(runtime, "merge_and_write", { provider: builder.provider, model: builder.model, apiKey: getProviderApiKey(builder.provider) });
    const out = await builder.invoke("merge_and_write", { org_path: orgFilePath, generated_yaml: generatedYaml }, runContext);
    if (out && "ok" in out && out.ok === false) {
        throw new Error(typeof out.error === "string" ? out.error : "Merge failed");
    }
    const summary = typeof out.summary === "string" ? out.summary : "";
    const added_count = typeof out.added_count === "number" ? out.added_count : 0;
    return { summary, added_count };
}
/** Run Verifier via agent; return true if pass. */
export async function runVerifierAgent(runtime, prd, summary) {
    const verifier = runtime.agents.get("verifier");
    const runContext = createRunContext(runtime, "verify_build", { provider: verifier.provider, model: verifier.model, apiKey: getProviderApiKey(verifier.provider) });
    const out = await verifier.invoke("verify_build", { prd, summary }, runContext);
    if (out && "ok" in out && out.ok === false)
        return false;
    return out.pass === true;
}
//# sourceMappingURL=agents.js.map