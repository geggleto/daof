import { describe, it, expect, vi } from "vitest";
import type { CapabilityDefinition } from "../src/schema/index.js";
import { createLoggerInstance } from "../src/capabilities/bundled/logger.js";
import { createEventEmitterInstance } from "../src/capabilities/bundled/event_emitter.js";
import { createWebhookNotifierInstance } from "../src/capabilities/bundled/webhook_notifier.js";
import { createKeyValueStoreInstance } from "../src/capabilities/bundled/key_value_store.js";
import { createImageGeneratorInstance } from "../src/capabilities/bundled/image_generator.js";
import { createTextGeneratorInstance } from "../src/capabilities/bundled/text_generator.js";
import { createSentimentAnalyzerInstance } from "../src/capabilities/bundled/sentiment_analyzer.js";
import { createXPosterInstance } from "../src/capabilities/bundled/x_poster.js";
import { createMetricsFetcherInstance } from "../src/capabilities/bundled/metrics_fetcher.js";
import { createFileUploaderInstance } from "../src/capabilities/bundled/file_uploader.js";
import { createSkillRunnerInstance } from "../src/capabilities/bundled/skill_runner.js";
import { createQueryCapabilityRegistryInstance } from "../src/capabilities/bundled/query_capability_registry.js";
import { createPruneRegistryInstance } from "../src/capabilities/bundled/prune_registry.js";
import { createMergeAndWriteInstance } from "../src/capabilities/bundled/merge_and_write.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const emptyDef: CapabilityDefinition = { type: "tool" };

describe("Logger", () => {
  it("returns { ok: true } and defaults level to info", async () => {
    const cap = createLoggerInstance("logger", emptyDef);
    const out = await cap.execute({ message: "hello" });
    expect(out).toEqual({ ok: true });
  });

  it("accepts level, message, and metadata", async () => {
    const cap = createLoggerInstance("logger", emptyDef);
    const out = await cap.execute({
      level: "warn",
      message: "warn me",
      metadata: { foo: "bar" },
    });
    expect(out).toEqual({ ok: true });
  });
});

describe("EventEmitter", () => {
  it("returns ok: true when no backbone", async () => {
    const def: CapabilityDefinition = { type: "tool", config: { queue: "events" } };
    const cap = createEventEmitterInstance("event_emitter", def);
    const out = await cap.execute({ event_type: "test", payload: {} });
    expect(out).toEqual({ ok: true });
  });

  it("calls backbone.publish when backbone is provided", async () => {
    const def: CapabilityDefinition = { type: "tool", config: { queue: "my-queue" } };
    const cap = createEventEmitterInstance("event_emitter", def);
    const publish = vi.fn().mockResolvedValue(undefined);
    const out = await cap.execute(
      { event_type: "e1", payload: { x: 1 } },
      { backbone: { publish } as never, invokeCapability: undefined, capabilityStore: undefined }
    );
    expect(out).toEqual({ ok: true });
    expect(publish).toHaveBeenCalledWith("my-queue", { event_type: "e1", payload: { x: 1 } });
  });
});

describe("WebhookNotifier", () => {
  it("returns error when url is missing", async () => {
    const cap = createWebhookNotifierInstance("webhook_notifier", emptyDef);
    const out = await cap.execute({ message: "hi" });
    expect(out).toEqual({ ok: false, error: "Missing url" });
  });

  it("returns ok: true when fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true })
    );
    const cap = createWebhookNotifierInstance("webhook_notifier", emptyDef);
    const out = await cap.execute({ url: "https://example.com/webhook", message: "hi" });
    expect(out).toEqual({ ok: true });
    vi.unstubAllGlobals();
  });
});

describe("KeyValueStore", () => {
  it("rejects invalid operation", async () => {
    const cap = createKeyValueStoreInstance("key_value_store", emptyDef);
    const out = await cap.execute({ operation: "invalid", key: "k" });
    expect(out).toEqual({ ok: false, error: "Invalid or missing operation; use get, set, or delete" });
  });

  it("rejects missing key", async () => {
    const cap = createKeyValueStoreInstance("key_value_store", emptyDef);
    const out = await cap.execute({ operation: "get", key: "" });
    expect(out).toEqual({ ok: false, error: "Missing key" });
  });

  it("set then get returns value (in-memory fallback)", async () => {
    const cap = createKeyValueStoreInstance("key_value_store", emptyDef);
    const key = `kv-test-${Date.now()}`;
    const setOut = await cap.execute({ operation: "set", key, value: "v1" });
    expect(setOut).toEqual({ ok: true });
    const getOut = await cap.execute({ operation: "get", key });
    expect(getOut).toEqual({ value: "v1" });
  });

  it("delete then get returns null", async () => {
    const cap = createKeyValueStoreInstance("key_value_store", emptyDef);
    const key = `kv-del-${Date.now()}`;
    await cap.execute({ operation: "set", key, value: 42 });
    await cap.execute({ operation: "delete", key });
    const getOut = await cap.execute({ operation: "get", key });
    expect(getOut).toEqual({ value: null });
  });

  it("rejects set without value", async () => {
    const cap = createKeyValueStoreInstance("key_value_store", emptyDef);
    const out = await cap.execute({ operation: "set", key: "k" });
    expect(out).toEqual({ ok: false, error: "Missing value for set" });
  });
});

describe("ImageGenerator", () => {
  it("returns error when config.endpoint is missing", async () => {
    const cap = createImageGeneratorInstance("image_generator", emptyDef);
    const out = await cap.execute({ prompt: "a cat" });
    expect(out).toEqual({ ok: false, error: "Missing config.endpoint" });
  });

  it("returns urls from response.urls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ urls: ["https://img1.png", "https://img2.png"] }),
      })
    );
    const def: CapabilityDefinition = { type: "tool", config: { endpoint: "https://api.example.com/gen" } };
    const cap = createImageGeneratorInstance("image_generator", def);
    const out = await cap.execute({ prompt: "a cat" });
    expect(out).toEqual({ urls: ["https://img1.png", "https://img2.png"] });
    vi.unstubAllGlobals();
  });
});

describe("TextGenerator", () => {
  it("returns error when config.endpoint is missing and no runContext.agentLlm", async () => {
    const cap = createTextGeneratorInstance("text_generator", emptyDef);
    const out = await cap.execute({ prompt: "Hello" });
    expect(out).toMatchObject({ ok: false });
    expect((out as { error: string }).error).toContain("Missing config.endpoint");
  });

  it("returns text from response.text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: "Generated sentence." }),
      })
    );
    const def: CapabilityDefinition = { type: "tool", config: { endpoint: "https://api.example.com/complete" } };
    const cap = createTextGeneratorInstance("text_generator", def);
    const out = await cap.execute({ prompt: "Hello" });
    expect(out).toEqual({ text: "Generated sentence." });
    vi.unstubAllGlobals();
  });
});

describe("SentimentAnalyzer", () => {
  it("returns error when config.endpoint is missing", async () => {
    const cap = createSentimentAnalyzerInstance("sentiment_analyzer", emptyDef);
    const out = await cap.execute({ text: "I love it" });
    expect(out).toEqual({ ok: false, error: "Missing config.endpoint" });
  });

  it("returns score and category from response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ score: 0.9, category: "positive" }),
      })
    );
    const def: CapabilityDefinition = { type: "tool", config: { endpoint: "https://api.example.com/sentiment" } };
    const cap = createSentimentAnalyzerInstance("sentiment_analyzer", def);
    const out = await cap.execute({ text: "I love it" });
    expect(out).toEqual({ score: 0.9, category: "positive" });
    vi.unstubAllGlobals();
  });
});

describe("XPoster", () => {
  it("returns error when content is missing", async () => {
    const cap = createXPosterInstance("x_poster", emptyDef);
    const out = await cap.execute({});
    expect(out).toEqual({ ok: false, error: "Missing content" });
  });

  it("returns stub post_id when endpoint is not configured", async () => {
    const cap = createXPosterInstance("x_poster", emptyDef);
    const out = await cap.execute({ content: "Hello world" });
    expect(out).toEqual({ post_id: "stub" });
  });
});

describe("MetricsFetcher", () => {
  it("returns views: 0, likes: 0 when endpoint is not configured", async () => {
    const cap = createMetricsFetcherInstance("metrics_fetcher", emptyDef);
    const out = await cap.execute({});
    expect(out).toEqual({ views: 0, likes: 0 });
  });
});

describe("FileUploader", () => {
  it("returns error when file_path is missing", async () => {
    const cap = createFileUploaderInstance("file_uploader", emptyDef);
    const out = await cap.execute({ destination: "local" });
    expect(out).toEqual({ ok: false, error: "Missing file_path" });
  });

  it("returns S3 not implemented for destination s3", async () => {
    const cap = createFileUploaderInstance("file_uploader", emptyDef);
    const out = await cap.execute({ file_path: "/any/path", destination: "s3" });
    expect(out).toEqual({ ok: false, error: "S3 not implemented" });
  });

  it("copies file to base_path and returns file:// url for local", async () => {
    const dir = join(tmpdir(), `file-upload-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const srcFile = join(dir, "source.txt");
    await writeFile(srcFile, "hello");
    const def: CapabilityDefinition = { type: "tool", config: { base_path: dir } };
    const cap = createFileUploaderInstance("file_uploader", def);
    const out = await cap.execute({ file_path: srcFile, destination: "local" });
    expect((out as { url?: string }).url).toMatch(/^file:\/\//);
    expect((out as { url?: string }).url).toContain("source.txt");
    await rm(dir, { recursive: true, force: true });
  });
});

describe("SkillRunner", () => {
  it("renders prompt template from input and returns { text } when no endpoint", async () => {
    const def: CapabilityDefinition = {
      type: "skill",
      prompt: "Hello {{ name }}, topic: {{ topic }}",
    };
    const cap = createSkillRunnerInstance("my_skill", def);
    const out = await cap.execute({ name: "Alice", topic: "weather" });
    expect(out).toEqual({ text: "Hello Alice, topic: weather" });
  });

  it("resolves nested keys in template", async () => {
    const def: CapabilityDefinition = {
      type: "skill",
      prompt: "Value: {{ data.value }}",
    };
    const cap = createSkillRunnerInstance("my_skill", def);
    const out = await cap.execute({ data: { value: "nested" } });
    expect(out).toEqual({ text: "Value: nested" });
  });

  it("returns empty string for missing template vars", async () => {
    const def: CapabilityDefinition = {
      type: "skill",
      prompt: "Hi {{ missing }}",
    };
    const cap = createSkillRunnerInstance("my_skill", def);
    const out = await cap.execute({});
    expect(out).toEqual({ text: "Hi " });
  });
});

describe("QueryCapabilityRegistry", () => {
  it("returns error when runContext has no registry", async () => {
    const cap = createQueryCapabilityRegistryInstance("query_capability_registry", emptyDef);
    const out = await cap.execute({ tags: ["x"] }, {});
    expect(out).toMatchObject({ ok: false });
    expect((out as { error?: string }).error).toMatch(/registry|not connected/i);
  });

  it("returns capability_ids and agent_ids from queryByTags when tags provided", async () => {
    const cap = createQueryCapabilityRegistryInstance("query_capability_registry", emptyDef);
    const runContext = {
      registry: {
        listAll: vi.fn().mockResolvedValue({ capability_ids: ["c1"], agent_ids: ["a1"] }),
        queryByTags: vi.fn().mockResolvedValue({ capability_ids: ["image_generator"], agent_ids: [] }),
        queryByCategory: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        getCapability: vi.fn().mockResolvedValue(null),
        getAgent: vi.fn().mockResolvedValue(null),
        upsertCapability: vi.fn().mockResolvedValue(undefined),
        upsertAgent: vi.fn().mockResolvedValue(undefined),
        listStale: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        archiveStale: vi.fn().mockResolvedValue({ archived_capability_ids: [], archived_agent_ids: [] }),
      },
    };
    const out = await cap.execute({ tags: ["image"] }, runContext);
    expect(out).toEqual({ capability_ids: ["image_generator"], agent_ids: [] });
  });

  it("returns listAll result when no tags or category", async () => {
    const cap = createQueryCapabilityRegistryInstance("query_capability_registry", emptyDef);
    const listAll = vi.fn().mockResolvedValue({ capability_ids: ["c1"], agent_ids: ["a1"] });
    const runContext = {
      registry: {
        listAll,
        queryByTags: vi.fn(),
        queryByCategory: vi.fn(),
        getCapability: vi.fn().mockResolvedValue(null),
        getAgent: vi.fn().mockResolvedValue(null),
        upsertCapability: vi.fn().mockResolvedValue(undefined),
        upsertAgent: vi.fn().mockResolvedValue(undefined),
        listStale: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        archiveStale: vi.fn().mockResolvedValue({ archived_capability_ids: [], archived_agent_ids: [] }),
      },
    };
    const out = await cap.execute({}, runContext);
    expect(out).toEqual({ capability_ids: ["c1"], agent_ids: ["a1"] });
    expect(listAll).toHaveBeenCalled();
  });
});

describe("PruneRegistry", () => {
  it("returns error when runContext has no registry", async () => {
    const cap = createPruneRegistryInstance("prune_registry", emptyDef);
    const out = await cap.execute({ older_than_days: 90 }, {});
    expect(out).toMatchObject({ ok: false });
    expect((out as { error?: string }).error).toMatch(/registry|not connected/i);
  });

  it("returns dry_run result when dry_run true", async () => {
    const cap = createPruneRegistryInstance("prune_registry", emptyDef);
    const listStale = vi.fn().mockResolvedValue({ capability_ids: ["old_cap"], agent_ids: ["old_agent"] });
    const runContext = {
      registry: {
        listStale,
        archiveStale: vi.fn(),
        listAll: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        queryByTags: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        queryByCategory: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        getCapability: vi.fn().mockResolvedValue(null),
        getAgent: vi.fn().mockResolvedValue(null),
        upsertCapability: vi.fn().mockResolvedValue(undefined),
        upsertAgent: vi.fn().mockResolvedValue(undefined),
      },
    };
    const out = await cap.execute({ older_than_days: 30, dry_run: true }, runContext);
    expect(out).toEqual({
      ok: true,
      archived_capability_ids: ["old_cap"],
      archived_agent_ids: ["old_agent"],
      dry_run: true,
    });
    expect(listStale).toHaveBeenCalledWith({ olderThanDays: 30, includeArchived: false });
    expect(runContext.registry.archiveStale).not.toHaveBeenCalled();
  });

  it("calls archiveStale when dry_run false", async () => {
    const cap = createPruneRegistryInstance("prune_registry", emptyDef);
    const listStale = vi.fn().mockResolvedValue({ capability_ids: ["c1"], agent_ids: [] });
    const archiveStale = vi.fn().mockResolvedValue({ archived_capability_ids: ["c1"], archived_agent_ids: [] });
    const runContext = {
      registry: {
        listStale,
        archiveStale,
        listAll: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        queryByTags: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        queryByCategory: vi.fn().mockResolvedValue({ capability_ids: [], agent_ids: [] }),
        getCapability: vi.fn().mockResolvedValue(null),
        getAgent: vi.fn().mockResolvedValue(null),
        upsertCapability: vi.fn().mockResolvedValue(undefined),
        upsertAgent: vi.fn().mockResolvedValue(undefined),
      },
    };
    const out = await cap.execute({ older_than_days: 90 }, runContext);
    expect(out).toMatchObject({ ok: true, dry_run: false, archived_capability_ids: ["c1"], archived_agent_ids: [] });
    expect(archiveStale).toHaveBeenCalledWith({ olderThanDays: 90 });
  });
});

describe("Merge_and_write", () => {
  const baseConfig = {
    version: "1.0" as const,
    org: { name: "Test", goals: [] },
    agents: {} as Record<string, unknown>,
    capabilities: { existing: { type: "tool" as const, description: "Existing" } },
    workflows: {} as Record<string, unknown>,
    backbone: { type: "redis" as const, config: { url: "redis://localhost", queues: [] } },
  };

  it("when runContext has getCurrentOrgConfig and updateOrgConfig, uses in-memory config as base and calls updateOrgConfig (no writeOrgFile)", async () => {
    const updateOrgConfig = vi.fn();
    const currentConfig = { ...baseConfig };
    const runContext = {
      getCurrentOrgConfig: () => currentConfig,
      updateOrgConfig,
    };
    const generatedYaml = `
capabilities:
  new_cap:
    type: tool
    description: New cap
agents: {}
workflows: {}
`;
    const cap = createMergeAndWriteInstance("merge_and_write", { type: "tool" });
    const out = await cap.execute(
      { org_path: "/tmp/org.yaml", generated_yaml: generatedYaml },
      runContext as never
    );
    expect(out).toMatchObject({ summary: expect.any(String), added_count: 1 });
    expect(updateOrgConfig).toHaveBeenCalledTimes(1);
    const merged = updateOrgConfig.mock.calls[0][0];
    expect(merged.capabilities).toHaveProperty("existing");
    expect(merged.capabilities).toHaveProperty("new_cap");
  });

  it("when runContext has no updateOrgConfig, returns error for missing file (loadYaml fails) unless path exists", async () => {
    const cap = createMergeAndWriteInstance("merge_and_write", { type: "tool" });
    const generatedYaml = `
capabilities:
  new_cap:
    type: tool
    description: New
agents: {}
workflows: {}
`;
    const out = await cap.execute(
      { org_path: "/nonexistent/org.yaml", generated_yaml: generatedYaml },
      undefined
    );
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("Failed to load") });
  });
});
