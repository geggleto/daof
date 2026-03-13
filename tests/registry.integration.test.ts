import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRegistryStore } from "../src/registry/registry-store.js";

/** Set MONGO_AVAILABLE=1 to run MongoDB registry integration tests (e.g. with docker compose up -d mongo). */
const mongoAvailable = process.env.MONGO_AVAILABLE === "1";

const testUri = process.env.REGISTRY_MONGO_URI ?? process.env.MONGO_URI ?? "mongodb://localhost:27017";

const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

describe("Registry store (MongoDB)", () => {
  let store: Awaited<ReturnType<typeof createRegistryStore>>;

  beforeAll(async () => {
    if (!mongoAvailable) return;
    store = await createRegistryStore(testUri);
  });

  afterAll(async () => {
    // Store does not expose disconnect; client is not closed (optional: add close to store for tests)
  });

  it("upsertCapability then getCapability and listAll includes id; getCapability sets last_accessed", async () => {
    if (!mongoAvailable) return;
    const capId = id("itest_cap");
    await store.upsertCapability(
      capId,
      { type: "tool", description: "Test cap" },
      { tags: ["itest", "a"], category: "test" }
    );
    const entry = await store.getCapability(capId);
    expect(entry).not.toBeNull();
    expect(entry!._id).toBe(capId);
    expect(entry!.tags).toContain("itest");
    expect(entry!.last_accessed).toBeDefined();
    expect(typeof entry!.last_accessed).toBe("string");
    const all = await store.listAll();
    expect(all.capability_ids).toContain(capId);
  }, 10000);

  it("upsertAgent then getAgent and listAll.agent_ids includes id; getAgent sets last_accessed", async () => {
    if (!mongoAvailable) return;
    const agentId = id("itest_agent");
    await store.upsertAgent(
      agentId,
      { provider: "cursor", model: "auto", role: "Tester", capabilities: [] },
      { tags: ["itest", "b"], role_category: "qa" }
    );
    const entry = await store.getAgent(agentId);
    expect(entry).not.toBeNull();
    expect(entry!._id).toBe(agentId);
    expect(entry!.last_accessed).toBeDefined();
    const all = await store.listAll();
    expect(all.agent_ids).toContain(agentId);
  }, 10000);

  it("queryByTags returns capability/agent ids with at least one matching tag ($in behavior)", async () => {
    if (!mongoAvailable) return;
    const tag = `itest_tag_${Date.now()}`;
    const capId = id("itest_cap");
    const agentId = id("itest_agent");
    await store.upsertCapability(capId, { type: "tool", description: "X" }, { tags: [tag, "x"] });
    await store.upsertAgent(agentId, { provider: "cursor", model: "auto", role: "R", capabilities: [] }, { tags: [tag] });
    const result = await store.queryByTags([tag], { matchAll: false });
    expect(result.capability_ids).toContain(capId);
    expect(result.agent_ids).toContain(agentId);
  }, 10000);

  it("queryByCategory returns ids where category (or role_category) matches", async () => {
    if (!mongoAvailable) return;
    const cat = `itest_cat_${Date.now()}`;
    const capId = id("itest_cap");
    const agentId = id("itest_agent");
    await store.upsertCapability(capId, { type: "tool", description: "Y" }, { category: cat });
    await store.upsertAgent(agentId, { provider: "cursor", model: "auto", role: "R", capabilities: [] }, { role_category: cat });
    const result = await store.queryByCategory(cat);
    expect(result.capability_ids).toContain(capId);
    expect(result.agent_ids).toContain(agentId);
  }, 10000);

  it("listStale returns capability/agent ids older than threshold", async () => {
    if (!mongoAvailable) return;
    const capId = id("itest_stale_cap");
    const agentId = id("itest_stale_agent");
    await store.upsertCapability(capId, { type: "tool", description: "Stale" }, { tags: ["itest_stale"] });
    await store.upsertAgent(agentId, { provider: "cursor", model: "auto", role: "R", capabilities: [] }, { tags: ["itest_stale"] });
    const stale = await store.listStale({ olderThanDays: 0 });
    expect(stale.capability_ids).toContain(capId);
    expect(stale.agent_ids).toContain(agentId);
  }, 10000);

  it("archiveStale sets archived_at and listAll excludes archived entries", async () => {
    if (!mongoAvailable) return;
    const capId = id("itest_archive_cap");
    const tag = `itest_archive_${Date.now()}`;
    await store.upsertCapability(capId, { type: "tool", description: "To archive" }, { tags: [tag] });
    let all = await store.listAll();
    expect(all.capability_ids).toContain(capId);
    await store.archiveStale({ olderThanDays: 0 });
    all = await store.listAll();
    expect(all.capability_ids).not.toContain(capId);
  }, 10000);

  it("archived entries are excluded from queryByTags", async () => {
    if (!mongoAvailable) return;
    const tag = `itest_archived_tag_${Date.now()}`;
    const capId = id("itest_archived_cap");
    await store.upsertCapability(capId, { type: "tool", description: "X" }, { tags: [tag] });
    let result = await store.queryByTags([tag], { matchAll: false });
    expect(result.capability_ids).toContain(capId);
    await store.archiveStale({ olderThanDays: 0 });
    result = await store.queryByTags([tag], { matchAll: false });
    expect(result.capability_ids).not.toContain(capId);
  }, 10000);
});
