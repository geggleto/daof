import { describe, it, expect, vi } from "vitest";
import { resolve } from "node:path";
import { loadYaml, validate } from "../src/parser/index.js";
import { bootstrap } from "../src/runtime/bootstrap.js";
import { runWorkflow } from "../src/workflow/executor.js";

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

describe("workflow integration", () => {
  const manifestPath = resolve(process.cwd(), "org.yaml");

  it("runWorkflow(runtime, 'build_on_request') with minimal payload runs planner step and context contains planner output", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = await bootstrap(config);
    const initialInput = {
      __initial: {
        description: "Add a test capability",
        request_id: "int-test-1",
        existing_capabilities: [] as string[],
      },
    };
    const result = await runWorkflow(runtime, "build_on_request", initialInput);
    expect(result.context).toHaveProperty("planner");
    expect(result.context.planner).toBeDefined();
  }, 20000);

  it("runWorkflow(runtime, 'daily_content_cycle') returns success false when workflow references undefined agent", async () => {
    const raw = loadYaml(manifestPath);
    const config = validate(raw);
    const runtime = await bootstrap(config);
    const result = await runWorkflow(runtime, "daily_content_cycle");
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/Workflow references unknown agent/);
  });
});
