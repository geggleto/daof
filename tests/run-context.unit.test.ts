import { describe, it, expect, vi } from "vitest";
import { createRunContext } from "../src/runtime/run-context.js";
import type { RunContextFactoryDeps } from "../src/runtime/run-context.js";
import type { CapabilityInstance } from "../src/types/json.js";

describe("createRunContext with agentLlm", () => {
  const agentLlm = { provider: "cursor", model: "auto", apiKey: "test-key" };

  it("includes agentLlm when passed", () => {
    const deps: RunContextFactoryDeps = {
      config: {
        version: "1.0",
        org: { name: "T", goals: [] },
        agents: {},
        capabilities: { cap1: { type: "tool", description: "Cap1" } },
        workflows: {},
        backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
      },
      capabilities: new Map([
        [
          "cap1",
          {
            execute: async () => ({}),
          } as CapabilityInstance,
        ],
      ]),
    };
    const ctx = createRunContext(deps, "cap1", agentLlm);
    expect(ctx.agentLlm).toEqual(agentLlm);
  });

  it("omits agentLlm when not passed", () => {
    const deps: RunContextFactoryDeps = {
      config: {
        version: "1.0",
        org: { name: "T", goals: [] },
        agents: {},
        capabilities: { cap1: { type: "tool", description: "Cap1" } },
        workflows: {},
        backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
      },
      capabilities: new Map([
        ["cap1", { execute: async () => ({}) } as CapabilityInstance],
      ]),
    };
    const ctx = createRunContext(deps, "cap1");
    expect(ctx.agentLlm).toBeUndefined();
  });

  it("nested invokeCapability inherits agentLlm", async () => {
    let nestedAgentLlm: unknown = null;
    const deps: RunContextFactoryDeps = {
      config: {
        version: "1.0",
        org: { name: "T", goals: [] },
        agents: {},
        capabilities: {
          caller: { type: "tool", description: "Caller", depends_on: ["callee"] },
          callee: { type: "tool", description: "Callee" },
        },
        workflows: {},
        backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
      },
      capabilities: new Map([
        [
          "caller",
          {
            execute: async (_input, runContext) => {
              const out = await runContext?.invokeCapability?.("callee", {});
              return out ?? {};
            },
          } as CapabilityInstance,
        ],
        [
          "callee",
          {
            execute: async (_input, runContext) => {
              nestedAgentLlm = runContext?.agentLlm;
              return { ok: true };
            },
          } as CapabilityInstance,
        ],
      ]),
    };
    const ctx = createRunContext(deps, "caller", agentLlm);
    const invoke = ctx.invokeCapability!;
    await invoke("callee", {});
    expect(nestedAgentLlm).toEqual(agentLlm);
  });

  it("includes updateOrgConfig and getCurrentOrgConfig when deps.orgFilePath is set (daemon mode)", () => {
    const config = {
      version: "1.0" as const,
      org: { name: "T", goals: [] },
      agents: {},
      capabilities: { cap1: { type: "tool" as const, description: "Cap1" } },
      workflows: {},
      backbone: { type: "redis" as const, config: { url: "redis://localhost", queues: [] } },
    };
    const deps: RunContextFactoryDeps = {
      config: { ...config },
      capabilities: new Map([["cap1", { execute: async () => ({}) } as CapabilityInstance]]),
      orgFilePath: "/path/to/org.yaml",
    };
    const ctx = createRunContext(deps, "cap1");
    expect(ctx.updateOrgConfig).toBeDefined();
    expect(ctx.getCurrentOrgConfig).toBeDefined();
    expect(ctx.getCurrentOrgConfig!()).toEqual(deps.config);
    const newConfig = { ...config, org: { name: "T2", goals: [] } };
    ctx.updateOrgConfig!(newConfig);
    expect(deps.config).toEqual(newConfig);
    expect(ctx.getCurrentOrgConfig!()).toEqual(newConfig);
  });

  it("omits updateOrgConfig and getCurrentOrgConfig when deps.orgFilePath is not set", () => {
    const deps: RunContextFactoryDeps = {
      config: {
        version: "1.0",
        org: { name: "T", goals: [] },
        agents: {},
        capabilities: { cap1: { type: "tool", description: "Cap1" } },
        workflows: {},
        backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
      },
      capabilities: new Map([["cap1", { execute: async () => ({}) } as CapabilityInstance]]),
    };
    const ctx = createRunContext(deps, "cap1");
    expect(ctx.updateOrgConfig).toBeUndefined();
    expect(ctx.getCurrentOrgConfig).toBeUndefined();
  });

  it("includes registry when deps.registry is set", () => {
    const mockRegistry = {
      listAll: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
      queryByTags: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
      queryByCategory: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
      getCapability: vi.fn().mockResolvedValue(null),
      getAgent: vi.fn().mockResolvedValue(null),
      upsertCapability: vi.fn().mockResolvedValue(undefined),
      upsertAgent: vi.fn().mockResolvedValue(undefined),
      listStale: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
      archiveStale: vi.fn().mockResolvedValue({ archived_capability_ids: [], archived_agent_ids: [] }),
    };
    const deps: RunContextFactoryDeps = {
      config: {
        version: "1.0",
        org: { name: "T", goals: [] },
        agents: {},
        capabilities: { cap1: { type: "tool", description: "Cap1" } },
        workflows: {},
        backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
      },
      capabilities: new Map([["cap1", { execute: async () => ({}) } as CapabilityInstance]]),
      registry: mockRegistry,
    };
    const ctx = createRunContext(deps, "cap1", agentLlm);
    expect(ctx.registry).toBe(mockRegistry);
  });
});
