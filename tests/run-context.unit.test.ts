import { describe, it, expect } from "vitest";
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
});
