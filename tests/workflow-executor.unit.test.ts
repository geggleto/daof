import { describe, it, expect } from "vitest";
import {
  executeStep,
  executeParallelStep,
  runWorkflow,
} from "../src/workflow/executor.js";
import { createAppCircuitBreaker } from "../src/fault/circuit-breaker.js";
import type { OrgRuntime } from "../src/runtime/bootstrap.js";
import type { SequentialStep, ParallelStep } from "../src/schema/index.js";
import type { CapabilityInput, CapabilityOutput } from "../src/types/json.js";
import type { CheckpointStore } from "../src/backbone/checkpoint-store.js";
import type { WorkflowContext } from "../src/workflow/types.js";

function createMockRuntime(agents: Map<string, { invoke: (action: string, input?: CapabilityInput) => Promise<CapabilityOutput> }>): OrgRuntime {
  return {
    config: {
      version: "1.0",
      org: { name: "Test", goals: [] },
      agents: {},
      capabilities: {},
      workflows: {
        single: {
          trigger: "event(x)",
          steps: [
            { agent: "alpha", action: "do_one" },
          ] as SequentialStep[],
        },
        parallel: {
          trigger: "cron(0 0 * * *)",
          steps: [
            {
              parallel: [
                { agent: "alpha", action: "do_one" },
                { agent: "beta", action: "do_two" },
              ],
            } as ParallelStep,
          ],
        },
        with_condition: {
          trigger: "event(y)",
          steps: [
            { agent: "alpha", action: "do_one" },
            { agent: "beta", action: "do_two", condition: "{{ alpha.ran }}" },
          ] as SequentialStep[],
        },
      },
      backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
    },
    capabilities: new Map(),
    agents: new Map(
      Array.from(agents.entries()).map(([id, impl]) => [
        id,
        {
          id,
          provider: "cursor",
          model: "test",
          role: "Test",
          fallback: undefined,
          maxConcurrentTasks: undefined,
          invoke: impl.invoke,
        },
      ])
    ),
  } as OrgRuntime;
}

describe("executeStep", () => {
  it("runs sequential step and adds output to context", async () => {
    const runtime = createMockRuntime(
      new Map([
        [
          "alpha",
          {
            invoke: async (_action: string) => ({
              ok: true,
              capabilityId: "do_one",
              input: {},
            }),
          },
        ],
      ])
    );
    const step: SequentialStep = { agent: "alpha", action: "do_one" };
    const context = {};
    const next = await executeStep(runtime, step, context);
    expect(next).toHaveProperty("alpha");
    expect(next.alpha).toMatchObject({ ok: true, capabilityId: "do_one" });
  });

  it("skips step when condition is false", async () => {
    const invoke = async () => ({ ok: true, capabilityId: "do_one", input: {} });
    const runtime = createMockRuntime(
      new Map([
        ["alpha", { invoke }],
        ["beta", { invoke }],
      ])
    );
    const step: SequentialStep = {
      agent: "beta",
      action: "do_two",
      condition: "{{ alpha.ran }}",
    };
    const context = { alpha: { ran: false } };
    const next = await executeStep(runtime, step, context);
    expect(next).toEqual(context);
    expect(next).not.toHaveProperty("beta");
  });
});

describe("executeParallelStep", () => {
  it("runs both steps and merges outputs by agentId_index and exposes __parallel_step_ids", async () => {
    const runtime = createMockRuntime(
      new Map([
        [
          "alpha",
          {
            invoke: async () => ({
              ok: true,
              capabilityId: "do_one",
              input: {},
            }),
          },
        ],
        [
          "beta",
          {
            invoke: async () => ({
              ok: true,
              capabilityId: "do_two",
              input: {},
            }),
          },
        ],
      ])
    );
    const step: ParallelStep = {
      parallel: [
        { agent: "alpha", action: "do_one" },
        { agent: "beta", action: "do_two" },
      ],
    };
    const context = {};
    const next = await executeParallelStep(runtime, step, context);
    expect(next).toHaveProperty("alpha_0");
    expect(next).toHaveProperty("beta_1");
    expect(next.alpha_0).toMatchObject({ capabilityId: "do_one" });
    expect(next.beta_1).toMatchObject({ capabilityId: "do_two" });
    expect(next).toHaveProperty("__parallel_step_ids");
    expect(Array.isArray((next as Record<string, unknown>).__parallel_step_ids)).toBe(true);
    expect((next as Record<string, unknown>).__parallel_step_ids).toHaveLength(2);
  });
});

describe("runWorkflow", () => {
  it("runs single-step workflow and returns success with context", async () => {
    const runtime = createMockRuntime(
      new Map([
        [
          "alpha",
          {
            invoke: async () => ({
              ok: true,
              capabilityId: "do_one",
              input: {},
            }),
          },
        ],
      ])
    );
    const result = await runWorkflow(runtime, "single");
    expect(result.success).toBe(true);
    expect(result.context).toHaveProperty("alpha");
    expect(result.error).toBeUndefined();
  });

  it("returns failure and error when step throws", async () => {
    const runtime = createMockRuntime(
      new Map([
        [
          "alpha",
          {
            invoke: async () => {
              throw new Error("cap failed");
            },
          },
        ],
      ])
    );
    const result = await runWorkflow(runtime, "single");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe("cap failed");
  });

  it("throws when workflow id not found", async () => {
    const runtime = createMockRuntime(new Map());
    await expect(runWorkflow(runtime, "nonexistent")).rejects.toThrow(
      "Workflow not found"
    );
  });

  it("circuit breaker opens after threshold failures and run fails gracefully", async () => {
    const breaker = createAppCircuitBreaker({
      failureThreshold: 5,
      windowSizeMs: 60_000,
    });
    const runtime = createMockRuntime(
      new Map([
        [
          "alpha",
          {
            invoke: async () => {
              throw new Error("step failed");
            },
          },
        ],
      ])
    );
    let lastError: string | null = null;
    for (let i = 0; i < 7; i++) {
      const r = await runWorkflow(runtime, "single", undefined, {
        circuitBreaker: breaker,
      });
      expect(r.success).toBe(false);
      lastError = r.error?.message ?? null;
      if (lastError && /circuit is open/i.test(lastError)) break;
    }
    expect(lastError).toMatch(/circuit is open/i);
  });

  it("saves checkpoint after each step when checkpointStore is set", async () => {
    const saves: Array<{ workflowId: string; runId: string; stepIndex: number; context: WorkflowContext }> = [];
    const store: CheckpointStore = {
      save: async (workflowId, runId, stepIndex, context) => {
        saves.push({ workflowId, runId, stepIndex, context });
      },
      load: async () => null,
    };
    const runtime = createMockRuntime(
      new Map([
        [
          "alpha",
          {
            invoke: async () => ({
              ok: true,
              capabilityId: "do_one",
              input: {},
            }),
          },
        ],
      ])
    );
    runtime.checkpointStore = store;
    const result = await runWorkflow(runtime, "single");
    expect(result.success).toBe(true);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.workflowId).toBe("single");
    expect(saves[0]!.stepIndex).toBe(0);
    expect(saves[0]!.context).toHaveProperty("alpha");
  });
});
