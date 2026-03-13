import { describe, it, expect, vi } from "vitest";
import { validate } from "../src/parser/index.js";
import { bootstrap } from "../src/runtime/bootstrap.js";
import type { ParsedYaml } from "../src/types/json.js";

vi.mock("../src/registry/registry-store.js", () => {
  const mockStore = {
    upsertCapability: vi.fn().mockResolvedValue(undefined),
    upsertAgent: vi.fn().mockResolvedValue(undefined),
    queryByTags: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
    queryByCategory: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
    getCapability: vi.fn().mockResolvedValue(null),
    getAgent: vi.fn().mockResolvedValue(null),
    listAll: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
    listStale: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
    archiveStale: vi.fn().mockResolvedValue({ archived_capability_ids: [], archived_agent_ids: [] }),
  };
  return {
    getRegistryMongoUri: vi.fn(() => "mongodb://localhost:27017"),
    createRegistryStore: vi.fn(() => Promise.resolve(mockStore)),
  };
});

const minimalValidOrg: ParsedYaml = {
  version: "1.0",
  org: { name: "Test", goals: [] },
  agents: {
    a1: {
      provider: "cursor",
      model: "auto",
      role: "Test",
      capabilities: [{ name: "logger" }],
    },
  },
  capabilities: { logger: { type: "tool", description: "Log" } },
  workflows: { w: { trigger: "event(x)", steps: [] } },
  backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
};

describe("schema validation (agent provider + model)", () => {
  it("accepts agent with provider and model", () => {
    const config = validate(minimalValidOrg);
    expect(config.agents.a1).toBeDefined();
    expect(config.agents.a1.provider).toBe("cursor");
    expect(config.agents.a1.model).toBe("auto");
  });

  it("rejects agent missing provider", () => {
    const raw = {
      ...minimalValidOrg,
      agents: {
        a1: {
          model: "auto",
          role: "Test",
          capabilities: [{ name: "logger" }],
        },
      },
    } as ParsedYaml;
    expect(() => validate(raw)).toThrow();
  });

  it("rejects agent missing model", () => {
    const raw = {
      ...minimalValidOrg,
      agents: {
        a1: {
          provider: "cursor",
          role: "Test",
          capabilities: [{ name: "logger" }],
        },
      },
    } as ParsedYaml;
    expect(() => validate(raw)).toThrow();
  });
});

describe("bootstrap agent provider validation", () => {
  it("throws when agent has unknown provider", async () => {
    const raw = {
      ...minimalValidOrg,
      agents: {
        a1: {
          provider: "unknown_provider",
          model: "auto",
          role: "Test",
          capabilities: [{ name: "logger" }],
        },
      },
    } as ParsedYaml;
    const config = validate(raw);
    await expect(bootstrap(config)).rejects.toThrow(/Unknown provider "unknown_provider"/);
  });
});

describe("schema validation (optional capability metadata)", () => {
  it("accepts capability with optional tags, category, intent", () => {
    const raw: ParsedYaml = {
      ...minimalValidOrg,
      capabilities: {
        c1: {
          type: "tool",
          description: "x",
          tags: ["a"],
          category: "cat",
          intent: "do x",
        },
      },
    };
    const config = validate(raw);
    expect(config.capabilities.c1).toBeDefined();
    expect(config.capabilities.c1.tags).toEqual(["a"]);
    expect(config.capabilities.c1.category).toBe("cat");
    expect(config.capabilities.c1.intent).toBe("do x");
  });
});

describe("schema validation (optional agent metadata)", () => {
  it("accepts agent with optional tags, role_category", () => {
    const raw: ParsedYaml = {
      ...minimalValidOrg,
      agents: {
        a1: {
          provider: "cursor",
          model: "auto",
          role: "Test",
          capabilities: [{ name: "logger" }],
          tags: ["writer"],
          role_category: "content",
        },
      },
    };
    const config = validate(raw);
    expect(config.agents.a1.tags).toEqual(["writer"]);
    expect(config.agents.a1.role_category).toBe("content");
  });
});

describe("schema validation (registry)", () => {
  it("accepts top-level registry with mongo_uri and returns it in config", () => {
    const raw: ParsedYaml = {
      ...minimalValidOrg,
      registry: { mongo_uri: "mongodb://custom" },
    };
    const config = validate(raw);
    expect(config.registry).toBeDefined();
    expect(config.registry?.mongo_uri).toBe("mongodb://custom");
  });
});
