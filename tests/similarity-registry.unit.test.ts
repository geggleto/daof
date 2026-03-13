import { describe, it, expect, vi } from "vitest";
import { runRegistryDuplicateCheck } from "../src/build/similarity.js";
import type { RegistryStore } from "../src/registry/registry-store.js";

function createMockRegistry(): RegistryStore & { queryByTags: ReturnType<typeof vi.fn>; queryByCategory: ReturnType<typeof vi.fn> } {
  const queryByTags = vi.fn();
  const queryByCategory = vi.fn();
  return {
    queryByTags,
    queryByCategory,
    listAll: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
    getCapability: vi.fn().mockResolvedValue(null),
    getAgent: vi.fn().mockResolvedValue(null),
    upsertCapability: vi.fn().mockResolvedValue(undefined),
    upsertAgent: vi.fn().mockResolvedValue(undefined),
    listStale: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
    archiveStale: vi.fn().mockResolvedValue({ archived_capability_ids: [], archived_agent_ids: [] }),
  };
}

describe("runRegistryDuplicateCheck", () => {
  it("returns duplicate pair when generated capability has tags matching registry", async () => {
    const registry = createMockRegistry();
    registry.queryByTags.mockImplementation(async (tags: string[]) => {
      if (tags.includes("image"))
        return { capability_ids: ["existing_cap"], agent_ids: [] };
      return { capability_ids: [], agent_ids: [] };
    });
    registry.queryByCategory.mockResolvedValue({ capability_ids: [], agent_ids: [] });

    const generated = {
      capabilities: {
        new_image: { type: "tool", description: "Generate images", tags: ["image"] },
      },
      agents: {},
    };
    const result = await runRegistryDuplicateCheck(registry, generated);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id1: "new_image",
      id2: "existing_cap",
      type: "capability",
      reason: "Metadata (tags) match in registry",
    });
  });

  it("returns empty when generated has no metadata (no tags/category/intent)", async () => {
    const registry = createMockRegistry();
    registry.queryByTags.mockResolvedValue({ capability_ids: ["other"], agent_ids: [] });
    registry.queryByCategory.mockResolvedValue({ capability_ids: ["other"], agent_ids: [] });

    const generated = {
      capabilities: {
        plain_cap: { type: "tool", description: "No tags or category" },
      },
      agents: {},
    };
    const result = await runRegistryDuplicateCheck(registry, generated);
    expect(result).toHaveLength(0);
  });

  it("returns agent duplicate pair when generated agent tags match registry", async () => {
    const registry = createMockRegistry();
    registry.queryByTags.mockImplementation(async (tags: string[]) => {
      if (tags.includes("analyst"))
        return { capability_ids: [], agent_ids: ["existing_analyst"] };
      return { capability_ids: [], agent_ids: [] };
    });
    registry.queryByCategory.mockResolvedValue({ capability_ids: [], agent_ids: [] });

    const generated = {
      capabilities: {},
      agents: {
        new_analyst: { provider: "cursor", model: "auto", role: "Analyst", capabilities: [], tags: ["analyst"] },
      },
    };
    const result = await runRegistryDuplicateCheck(registry, generated);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id1: "new_analyst",
      id2: "existing_analyst",
      type: "agent",
      reason: "Metadata (tags) match in registry",
    });
  });

  it("returns capability duplicate by category when queryByCategory matches", async () => {
    const registry = createMockRegistry();
    registry.queryByTags.mockResolvedValue({ capability_ids: [], agent_ids: [] });
    registry.queryByCategory.mockImplementation(async (category: string) => {
      if (category === "metrics")
        return { capability_ids: ["metrics_fetcher"], agent_ids: [] };
      return { capability_ids: [], agent_ids: [] };
    });

    const generated = {
      capabilities: {
        new_metrics: { type: "tool", description: "Fetch metrics", category: "metrics" },
      },
      agents: {},
    };
    const result = await runRegistryDuplicateCheck(registry, generated);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id1: "new_metrics",
      id2: "metrics_fetcher",
      type: "capability",
      reason: 'Category "metrics" match in registry',
    });
  });
});
