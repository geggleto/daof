import { describe, it, expect, vi } from "vitest";
import { loadYaml, validate } from "../src/parser/index.js";
import { bootstrap } from "../src/runtime/bootstrap.js";
import { resolve } from "node:path";

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

vi.mock("../src/tickets/index.js", () => ({
  createTicketStore: vi.fn(() =>
    Promise.resolve({
      create: vi.fn().mockResolvedValue(undefined),
      appendUpdate: vi.fn().mockResolvedValue(undefined),
      setStatus: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    })
  ),
}));

describe("org.yaml (canonical manifest)", () => {
  const manifestPath = resolve(process.cwd(), "org.yaml");

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

  it("has build_on_request workflow with first step planner / produce_prd", () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const workflow = config.workflows.build_on_request;
    expect(workflow).toBeDefined();
    expect(workflow.steps.length).toBeGreaterThan(0);
    const firstStep = workflow.steps[0];
    expect("agent" in firstStep).toBe(true);
    expect("action" in firstStep).toBe(true);
    if ("agent" in firstStep && "action" in firstStep) {
      expect(firstStep.agent).toBe("planner");
      expect(firstStep.action).toBe("produce_prd");
    }
  });

  it("bootstraps and planner has provider and model", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = await bootstrap(config);
    const planner = runtime.agents.get("planner");
    expect(planner).toBeDefined();
    if (!planner) return;
    expect(planner.provider).toBe("cursor");
    expect(planner.model).toBe("auto");
  });

  it("bootstraps and application_engineer.invoke('logger', { message: 'hi' }) returns ok", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = await bootstrap(config);
    expect(runtime.agents.size).toBeGreaterThan(0);
    expect(runtime.capabilities.size).toBeGreaterThan(0);
    const application_engineer = runtime.agents.get("application_engineer");
    expect(application_engineer).toBeDefined();
    if (!application_engineer) return;
    const result = await application_engineer.invoke("logger", { message: "hi" });
    expect(result).toHaveProperty("ok", true);
  });
});
