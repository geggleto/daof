import { describe, it, expect } from "vitest";
import {
  getProvider,
  getProviderApiKey,
  isKnownProvider,
  KNOWN_PROVIDER_IDS,
} from "../src/providers/registry.js";

describe("providers registry", () => {
  it("KNOWN_PROVIDER_IDS includes cursor", () => {
    expect(KNOWN_PROVIDER_IDS).toContain("cursor");
  });

  it("isKnownProvider returns true for cursor", () => {
    expect(isKnownProvider("cursor")).toBe(true);
  });

  it("isKnownProvider returns false for unknown", () => {
    expect(isKnownProvider("unknown")).toBe(false);
  });

  it("getProvider('cursor') returns Cursor definition", () => {
    const p = getProvider("cursor");
    expect(p).toBeDefined();
    expect(p!.id).toBe("cursor");
    expect(p!.apiKeyEnvVar).toBe("CURSOR_API_KEY");
  });

  it("getProvider('unknown') returns undefined", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });

  it("getProviderApiKey('cursor') returns process.env.CURSOR_API_KEY", () => {
    const before = process.env.CURSOR_API_KEY;
    process.env.CURSOR_API_KEY = "test-key-123";
    try {
      expect(getProviderApiKey("cursor")).toBe("test-key-123");
    } finally {
      if (before !== undefined) process.env.CURSOR_API_KEY = before;
      else delete process.env.CURSOR_API_KEY;
    }
  });

  it("getProviderApiKey('unknown') returns undefined", () => {
    expect(getProviderApiKey("unknown")).toBeUndefined();
  });
});
