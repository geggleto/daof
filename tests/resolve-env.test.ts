import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveEnv } from "../src/config/resolve-env.js";
import type { OrgConfig } from "../src/schema/index.js";

describe("resolveEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("replaces env(FOO) with process.env.FOO when set", () => {
    process.env.FOO = "secret";
    const config: OrgConfig = {
      version: "1.0",
      org: { name: "Test", goals: [] },
      agents: {},
      capabilities: {
        cap1: {
          type: "tool",
          config: { api_key: "env(FOO)" },
        },
      },
      workflows: {},
      backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
    };
    const resolved = resolveEnv(config);
    expect(resolved.capabilities.cap1?.config).toHaveProperty("api_key", "secret");
  });

  it("leaves env(FOO) as-is when process.env.FOO is undefined", () => {
    const config: OrgConfig = {
      version: "1.0",
      org: { name: "Test", goals: [] },
      agents: {},
      capabilities: {
        cap1: {
          type: "tool",
          config: { api_key: "env(MISSING)" },
        },
      },
      workflows: {},
      backbone: { type: "redis", config: { url: "redis://localhost", queues: [] } },
    };
    const resolved = resolveEnv(config);
    expect(resolved.capabilities.cap1?.config).toHaveProperty("api_key", "env(MISSING)");
  });
});
