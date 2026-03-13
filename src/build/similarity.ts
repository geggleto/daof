/**
 * Similarity check: detect duplicate or near-duplicate capabilities/agents in generated YAML.
 * Supports registry-based (metadata) duplicate check and LLM-based semantic check.
 */
import { getProviderApiKey } from "../providers/registry.js";
import type { OrgConfig } from "../schema/index.js";
import type { RegistryStore } from "../registry/registry-store.js";
import type { RegistryMetadata } from "../registry/types.js";
import { createVerifySimilarityInstance, type SimilarityDuplicate } from "../capabilities/bundled/verify_similarity.js";
import type { JsonValue } from "../types/json.js";

function metadataFromDefinition(def: Record<string, unknown>): RegistryMetadata & { role_category?: string } {
  const tags = Array.isArray(def.tags) ? (def.tags as string[]) : [];
  const category = typeof def.category === "string" ? def.category : undefined;
  const intent = typeof def.intent === "string" ? def.intent : undefined;
  const role_category = typeof def.role_category === "string" ? def.role_category : undefined;
  return { tags, category, intent, role_category };
}

/**
 * Registry-based duplicate check: for each proposed capability/agent, query registry by metadata;
 * if a registry entry matches (same tags/category/intent), treat as duplicate (proposed id vs registry id).
 */
export async function runRegistryDuplicateCheck(
  registry: RegistryStore,
  generated: { capabilities: Record<string, unknown>; agents: Record<string, unknown> }
): Promise<SimilarityDuplicate[]> {
  const duplicates: SimilarityDuplicate[] = [];

  for (const [proposedId, def] of Object.entries(generated.capabilities)) {
    if (typeof def !== "object" || def === null) continue;
    const meta = metadataFromDefinition(def as Record<string, unknown>);
    const tags = meta.tags ?? [];
    if (tags.length === 0 && !meta.category && !meta.intent) continue;
    const byTags = tags.length > 0 ? await registry.queryByTags(tags, { matchAll: false }) : { capability_ids: [] as string[], agent_ids: [] as string[] };
    for (const existingId of byTags.capability_ids) {
      if (existingId !== proposedId) {
        duplicates.push({
          id1: proposedId,
          id2: existingId,
          type: "capability",
          reason: "Metadata (tags) match in registry",
        });
        break;
        // One duplicate pair per proposed id is enough
      }
    }
    if (meta.category) {
      const byCat = await registry.queryByCategory(meta.category);
      for (const existingId of byCat.capability_ids) {
        if (existingId !== proposedId && !duplicates.some((d) => d.id1 === proposedId && d.id2 === existingId)) {
          duplicates.push({
            id1: proposedId,
            id2: existingId,
            type: "capability",
            reason: `Category "${meta.category}" match in registry`,
          });
          break;
        }
      }
    }
  }

  for (const [proposedId, def] of Object.entries(generated.agents)) {
    if (typeof def !== "object" || def === null) continue;
    const meta = metadataFromDefinition(def as Record<string, unknown>);
    const tags = meta.tags ?? [];
    if (tags.length === 0 && !meta.role_category) continue;
    const byTags = tags.length > 0 ? await registry.queryByTags(tags, { matchAll: false }) : { capability_ids: [] as string[], agent_ids: [] as string[] };
    for (const existingId of byTags.agent_ids) {
      if (existingId !== proposedId) {
        duplicates.push({
          id1: proposedId,
          id2: existingId,
          type: "agent",
          reason: "Metadata (tags) match in registry",
        });
        break;
      }
    }
  }

  return duplicates;
}

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
