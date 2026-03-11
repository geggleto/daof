import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadYaml, validate } from "../src/parser/index.js";
import { bootstrap } from "../src/runtime/bootstrap.js";
import { runWorkflow } from "../src/workflow/executor.js";

describe("workflow integration", () => {
  const manifestPath = resolve(process.cwd(), "org.example.yaml");

  it("runWorkflow(runtime, 'hourly_metrics') succeeds and context contains data_analyst output", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = bootstrap(config);
    const result = await runWorkflow(runtime, "hourly_metrics");
    expect(result.success).toBe(true);
    expect(result.context).toHaveProperty("data_analyst");
    expect(result.context.data_analyst).toHaveProperty("ok", true);
    expect(result.context.data_analyst).toHaveProperty("capabilityId", "collect_metrics");
  });

  it("runWorkflow(runtime, 'daily_content_cycle') runs steps in order and context has step outputs", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = bootstrap(config);
    const result = await runWorkflow(runtime, "daily_content_cycle");
    expect(result.success).toBe(true);
    const ctx = result.context;
    expect(ctx).toHaveProperty("ceo");
    expect(ctx).toHaveProperty("content_writer");
    expect(ctx.ceo).toHaveProperty("capabilityId", "check_budget");
    expect(ctx.content_writer).toHaveProperty("capabilityId");
  });
});
