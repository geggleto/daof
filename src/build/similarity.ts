/**
 * Similarity check: detect duplicate or near-duplicate capabilities/agents in generated YAML.
 */
import { getProviderApiKey } from "../providers/registry.js";
import type { OrgConfig } from "../schema/index.js";
import { createVerifySimilarityInstance, type SimilarityDuplicate } from "../capabilities/bundled/verify_similarity.js";
import type { JsonValue } from "../types/json.js";

/** Run similarity check; returns list of duplicate pairs. On capability error, throws. */
export async function runSimilarityCheck(
  providerId: string,
  config: OrgConfig,
  generated: { capabilities: Record<string, unknown>; agents: Record<string, unknown>; workflows: Record<string, unknown> }
): Promise<SimilarityDuplicate[]> {
  const apiKey = getProviderApiKey(providerId);
  const runContext = {
    agentLlm: { provider: providerId, model: "auto", apiKey },
  };
  const instance = createVerifySimilarityInstance("verify_similarity", {
    type: "tool",
    description: "Check for duplicate or near-duplicate capabilities/agents",
  });
  const out = await instance.execute(
    {
      proposed_capabilities: generated.capabilities as JsonValue,
      existing_capabilities: config.capabilities as JsonValue,
      proposed_agents: generated.agents as JsonValue,
      existing_agents: config.agents as JsonValue,
    },
    runContext
  );
  if (out && "ok" in out && out.ok === false) {
    throw new Error(typeof (out as { error?: string }).error === "string" ? (out as { error: string }).error : "Similarity check failed");
  }
  const duplicates = (out as { duplicates?: SimilarityDuplicate[] }).duplicates ?? [];
  return Array.isArray(duplicates) ? duplicates : [];
}
