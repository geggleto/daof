import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getRegistryMongoUri } from "../src/registry/registry-store.js";

describe("getRegistryMongoUri", () => {
  const envRestore: Record<string, string | undefined> = {};

  beforeEach(() => {
    envRestore.REGISTRY_MONGO_URI = process.env.REGISTRY_MONGO_URI;
    envRestore.MONGO_URI = process.env.MONGO_URI;
    delete process.env.REGISTRY_MONGO_URI;
    delete process.env.MONGO_URI;
  });

  afterEach(() => {
    if (envRestore.REGISTRY_MONGO_URI !== undefined) process.env.REGISTRY_MONGO_URI = envRestore.REGISTRY_MONGO_URI;
    else delete process.env.REGISTRY_MONGO_URI;
    if (envRestore.MONGO_URI !== undefined) process.env.MONGO_URI = envRestore.MONGO_URI;
    else delete process.env.MONGO_URI;
  });

  it("returns default when no args and no env", () => {
    expect(getRegistryMongoUri()).toBe("mongodb://localhost:27017");
  });

  it("returns org URI (trimmed) when provided", () => {
    expect(getRegistryMongoUri("mongodb://org/config")).toBe("mongodb://org/config");
    expect(getRegistryMongoUri("  mongodb://org/config  ")).toBe("mongodb://org/config");
  });

  it("falls back to env or default when org URI is empty string", () => {
    expect(getRegistryMongoUri("")).toBe("mongodb://localhost:27017");
    expect(getRegistryMongoUri("   ")).toBe("mongodb://localhost:27017");

    process.env.REGISTRY_MONGO_URI = "mongodb://env-registry";
    expect(getRegistryMongoUri("")).toBe("mongodb://env-registry");
    expect(getRegistryMongoUri("   ")).toBe("mongodb://env-registry");
    delete process.env.REGISTRY_MONGO_URI;

    process.env.MONGO_URI = "mongodb://env-mongo";
    expect(getRegistryMongoUri("")).toBe("mongodb://env-mongo");
    delete process.env.MONGO_URI;
  });

  it("prefers REGISTRY_MONGO_URI over MONGO_URI when both set", () => {
    process.env.REGISTRY_MONGO_URI = "mongodb://registry";
    process.env.MONGO_URI = "mongodb://mongo";
    expect(getRegistryMongoUri()).toBe("mongodb://registry");
  });
});
