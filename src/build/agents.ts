/**
 * Build flow agents: planner, generator, merge-and-write, verifier (via org-level agents).
 */
import { getProviderApiKey } from "../providers/registry.js";
import type { OrgRuntime } from "../runtime/bootstrap.js";
import { createRunContext } from "../runtime/run-context.js";

/** Run Planner via agent; return prd or throw. */
export async function runPlannerAgent(runtime: OrgRuntime, description: string): Promise<string> {
  const planner = runtime.agents.get("planner")!;
  const runContext = createRunContext(
    runtime,
    "produce_prd",
    { provider: planner.provider, model: planner.model, apiKey: getProviderApiKey(planner.provider) }
  );
  const out = await planner.invoke("produce_prd", { description }, runContext);
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Planner failed");
  }
  const prd = typeof (out as { prd?: string }).prd === "string" ? (out as { prd: string }).prd : "";
  if (!prd) throw new Error("Planner returned empty PRD.");
  return prd;
}

/** Run Generator via agent; return yaml text or throw. */
export async function runGeneratorAgent(
  runtime: OrgRuntime,
  description: string,
  prd: string,
  existingCapabilityIds: string[]
): Promise<string> {
  const generator = runtime.agents.get("generator")!;
  const runContext = createRunContext(
    runtime,
    "generate_yaml",
    { provider: generator.provider, model: generator.model, apiKey: getProviderApiKey(generator.provider) }
  );
  const out = await generator.invoke(
    "generate_yaml",
    { description, prd, existing_capabilities: existingCapabilityIds },
    runContext
  );
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Generator failed");
  }
  const yaml = typeof (out as { yaml?: string }).yaml === "string" ? (out as { yaml: string }).yaml : "";
  if (!yaml) throw new Error("Generator returned empty response.");
  return yaml;
}

/** Run merge_and_write via builder agent; return { summary, added_count } or throw. */
export async function runMergeAndWriteAgent(
  runtime: OrgRuntime,
  orgFilePath: string,
  generatedYaml: string
): Promise<{ summary: string; added_count: number }> {
  const builder = runtime.agents.get("builder")!;
  const runContext = createRunContext(
    runtime,
    "merge_and_write",
    { provider: builder.provider, model: builder.model, apiKey: getProviderApiKey(builder.provider) }
  );
  const out = await builder.invoke(
    "merge_and_write",
    { org_path: orgFilePath, generated_yaml: generatedYaml },
    runContext
  );
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Merge failed");
  }
  const summary = typeof (out as { summary?: string }).summary === "string" ? (out as { summary: string }).summary : "";
  const added_count = typeof (out as { added_count?: number }).added_count === "number" ? (out as { added_count: number }).added_count : 0;
  return { summary, added_count };
}

/** Run Verifier via agent; return true if pass. */
export async function runVerifierAgent(runtime: OrgRuntime, prd: string, summary: string): Promise<boolean> {
  const verifier = runtime.agents.get("verifier")!;
  const runContext = createRunContext(
    runtime,
    "verify_build",
    { provider: verifier.provider, model: verifier.model, apiKey: getProviderApiKey(verifier.provider) }
  );
  const out = await verifier.invoke("verify_build", { prd, summary }, runContext);
  if (out && "ok" in out && out.ok === false) return false;
  return (out as { pass?: boolean }).pass === true;
}
