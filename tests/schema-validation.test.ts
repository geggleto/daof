import { describe, it, expect } from "vitest";
import { validate } from "../src/parser/index.js";
import { bootstrap } from "../src/runtime/bootstrap.js";
import type { ParsedYaml } from "../src/types/json.js";

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
  it("throws when agent has unknown provider", () => {
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
    expect(() => bootstrap(config)).toThrow(/Unknown provider "unknown_provider"/);
  });
});
