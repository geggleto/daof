import { describe, it, expect } from "vitest";
import {
  runAgentPipeline,
  runCapabilityPipeline,
  executeCapabilityWithMiddleware,
  type AgentMiddlewareContext,
  type CapabilityMiddlewareContext,
  type RuntimeWithMiddleware,
} from "../src/runtime/middleware.js";
import {
  recordAgentStep,
  loadAgentIndex,
  loadAgentMetrics,
  buildAgentReport,
  METRICS_INDEX_KEY,
} from "../src/runtime/agent-metrics-store.js";
import {
  resolveAgentMiddlewares,
  resolveCapabilityMiddlewares,
  getKnownAgentMiddlewareNames,
  registerAgentMiddleware,
} from "../src/runtime/middleware-registry.js";

describe("runAgentPipeline", () => {
  it("runs no middlewares when array is empty", async () => {
    const next = async () => ({ ok: true });
    const ctx = {} as AgentMiddlewareContext;
    const result = await runAgentPipeline([], ctx, next);
    expect(result).toEqual({ ok: true });
  });

  it("runs single middleware then next", async () => {
    const seen: string[] = [];
    const m1 = async (_ctx: AgentMiddlewareContext, next: () => Promise<{ ok: boolean }>) => {
      seen.push("before");
      const out = await next();
      seen.push("after");
      return out;
    };
    const next = async () => {
      seen.push("next");
      return { ok: true };
    };
    const ctx = {} as AgentMiddlewareContext;
    const result = await runAgentPipeline([m1], ctx, next);
    expect(seen).toEqual(["before", "next", "after"]);
    expect(result).toEqual({ ok: true });
  });

  it("runs multiple middlewares in order", async () => {
    const seen: string[] = [];
    const m1 = async (_ctx: AgentMiddlewareContext, next: () => Promise<{ x: number }>) => {
      seen.push("1");
      return next();
    };
    const m2 = async (_ctx: AgentMiddlewareContext, next: () => Promise<{ x: number }>) => {
      seen.push("2");
      return next();
    };
    const result = await runAgentPipeline(
      [m1, m2],
      {} as AgentMiddlewareContext,
      async () => ({ x: 42 })
    );
    expect(seen).toEqual(["1", "2"]);
    expect(result).toEqual({ x: 42 });
  });
});

describe("runCapabilityPipeline", () => {
  it("runs no middlewares when array is empty", async () => {
    const result = await runCapabilityPipeline(
      [],
      {} as CapabilityMiddlewareContext,
      async () => ({ done: true })
    );
    expect(result).toEqual({ done: true });
  });
});

describe("agent-metrics-store", () => {
  const memStore = {
    data: new Map<string, unknown>(),
    async get(key: string) {
      return this.data.get(key) ?? null;
    },
    async set(key: string, value: unknown) {
      this.data.set(key, value);
    },
    async delete(key: string) {
      this.data.delete(key);
    },
  };

  it("recordAgentStep and loadAgentIndex roundtrip", async () => {
    memStore.data.clear();
    await recordAgentStep(memStore as any, "agent1", 100, true);
    await recordAgentStep(memStore as any, "agent1", 200, false);
    const ids = await loadAgentIndex(memStore as any);
    expect(ids).toContain("agent1");
    const metrics = await loadAgentMetrics(memStore as any, "agent1");
    expect(metrics.agentId).toBe("agent1");
    expect(metrics.records).toHaveLength(2);
    expect(metrics.records[0].durationMs).toBe(100);
    expect(metrics.records[0].success).toBe(true);
    expect(metrics.records[1].success).toBe(false);
  });

  it("buildAgentReport aggregates over lookback", async () => {
    memStore.data.clear();
    await recordAgentStep(memStore as any, "a2", 50, true);
    const metrics = await loadAgentMetrics(memStore as any, "a2");
    const report = buildAgentReport(metrics, 24 * 60 * 60 * 1000);
    expect(report.agent_id).toBe("a2");
    expect(report.task_completions).toBe(1);
    expect(report.failure_count).toBe(0);
    expect(report.avg_step_duration_ms).toBe(50);
  });
});

describe("middleware-registry", () => {
  it("getKnownAgentMiddlewareNames includes agent_metrics", () => {
    const names = getKnownAgentMiddlewareNames();
    expect(names).toContain("agent_metrics");
  });

  it("resolveAgentMiddlewares returns middleware for agent_metrics", () => {
    const runtime: RuntimeWithMiddleware = {
      config: {} as any,
      capabilities: new Map(),
    };
    const middlewares = resolveAgentMiddlewares(["agent_metrics"], runtime);
    expect(middlewares).toHaveLength(1);
    expect(typeof middlewares[0]).toBe("function");
  });

  it("resolveAgentMiddlewares throws for unknown name", () => {
    const runtime: RuntimeWithMiddleware = {
      config: {} as any,
      capabilities: new Map(),
    };
    expect(() => resolveAgentMiddlewares(["unknown_foo"], runtime)).toThrow(
      /Unknown agent middleware: unknown_foo/
    );
  });

  it("resolveCapabilityMiddlewares throws for unknown name", () => {
    const runtime: RuntimeWithMiddleware = {
      config: {} as any,
      capabilities: new Map(),
    };
    expect(() => resolveCapabilityMiddlewares(["unknown_cap"], runtime)).toThrow(
      /Unknown capability middleware/
    );
  });
});

describe("executeCapabilityWithMiddleware", () => {
  it("invokes instance.execute when no capability middleware", async () => {
    const runtime: RuntimeWithMiddleware = {
      config: {} as any,
      capabilities: new Map(),
    };
    const instance = {
      execute: async (input: Record<string, unknown>) => ({ echoed: input }),
    };
    const runContext = {};
    const result = await executeCapabilityWithMiddleware(
      runtime,
      "cap1",
      instance as any,
      { x: 1 },
      runContext as any
    );
    expect(result).toEqual({ echoed: { x: 1 } });
  });
});
