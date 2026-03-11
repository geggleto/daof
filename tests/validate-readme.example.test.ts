import { describe, it, expect } from "vitest";
import { loadYaml, validate } from "../src/parser/index.js";
import { bootstrap } from "../src/runtime/bootstrap.js";
import { resolve } from "node:path";

describe("org.example.yaml (readme canonical example)", () => {
  const manifestPath = resolve(process.cwd(), "org.example.yaml");

  it("loads and validates without throwing", () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    expect(config).toBeDefined();
  });

  it("has expected top-level keys", () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    expect(config).toHaveProperty("version");
    expect(config).toHaveProperty("org");
    expect(config).toHaveProperty("agents");
    expect(config).toHaveProperty("capabilities");
    expect(config).toHaveProperty("workflows");
    expect(config).toHaveProperty("backbone");
  });

  it("has daily_content_cycle workflow with first step ceo / check_budget", () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const workflow = config.workflows.daily_content_cycle;
    expect(workflow).toBeDefined();
    expect(workflow.steps.length).toBeGreaterThan(0);
    const firstStep = workflow.steps[0];
    expect("agent" in firstStep).toBe(true);
    expect("action" in firstStep).toBe(true);
    if ("agent" in firstStep && "action" in firstStep) {
      expect(firstStep.agent).toBe("ceo");
      expect(firstStep.action).toBe("check_budget");
    }
  });

  it("bootstraps and ceo has provider and model", () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = bootstrap(config);
    const ceo = runtime.agents.get("ceo");
    expect(ceo).toBeDefined();
    if (!ceo) return;
    expect(ceo.provider).toBe("cursor");
    expect(ceo.model).toBe("auto");
  });

  it("bootstraps and ceo.invoke('check_budget', {}) returns stub output", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = bootstrap(config);
    expect(runtime.agents.size).toBeGreaterThan(0);
    expect(runtime.capabilities.size).toBeGreaterThan(0);
    const ceo = runtime.agents.get("ceo");
    expect(ceo).toBeDefined();
    if (!ceo) return;
    const result = await ceo.invoke("check_budget", {});
    expect(result).toHaveProperty("ok", true);
    expect(result).toHaveProperty("capabilityId", "check_budget");
    expect(result).toHaveProperty("input");
  });
});
