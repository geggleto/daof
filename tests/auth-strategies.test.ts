import { describe, it, expect } from "vitest";
import { bearerStrategy } from "../src/capabilities/auth/strategies/bearer.js";
import { apiKeyStrategy } from "../src/capabilities/auth/strategies/api_key.js";
import { basicStrategy } from "../src/capabilities/auth/strategies/basic.js";
import {
  getAuthStrategy,
  getAuthHeaders,
  getAuthHeadersFromCapabilityConfig,
} from "../src/capabilities/auth/registry.js";

describe("Bearer strategy", () => {
  it("returns Authorization Bearer header when token is present", () => {
    const headers = bearerStrategy.getHeaders({ token: "secret-token" });
    expect(headers).toEqual({ Authorization: "Bearer secret-token" });
  });

  it("returns empty object when token is missing", () => {
    expect(bearerStrategy.getHeaders({})).toEqual({});
    expect(bearerStrategy.getHeaders({ token: "" })).toEqual({});
  });

  it("returns empty object when token is not a string", () => {
    expect(bearerStrategy.getHeaders({ token: 123 })).toEqual({});
  });
});

describe("API-Key strategy", () => {
  it("returns X-API-Key header by default when api_key is present", () => {
    const headers = apiKeyStrategy.getHeaders({ api_key: "my-key" });
    expect(headers).toEqual({ "X-API-Key": "my-key" });
  });

  it("returns custom header when header is specified", () => {
    const headers = apiKeyStrategy.getHeaders({
      api_key: "key",
      header: "Authorization",
    });
    expect(headers).toEqual({ Authorization: "key" });
  });

  it("returns empty object when api_key is missing", () => {
    expect(apiKeyStrategy.getHeaders({})).toEqual({});
    expect(apiKeyStrategy.getHeaders({ api_key: "" })).toEqual({});
  });

  it("returns empty object when api_key is not a string", () => {
    expect(apiKeyStrategy.getHeaders({ api_key: 0 })).toEqual({});
  });
});

describe("Basic strategy", () => {
  it("returns Authorization Basic header with base64 credentials", () => {
    const headers = basicStrategy.getHeaders({
      username: "alice",
      password: "pwd",
    });
    expect(headers).toHaveProperty("Authorization");
    expect(headers.Authorization).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
    const decoded = Buffer.from(headers.Authorization.slice(6), "base64").toString("utf8");
    expect(decoded).toBe("alice:pwd");
  });

  it("returns empty object when username or password is missing", () => {
    expect(basicStrategy.getHeaders({})).toEqual({});
    expect(basicStrategy.getHeaders({ username: "a" })).toEqual({});
    expect(basicStrategy.getHeaders({ password: "p" })).toEqual({});
  });

  it("returns empty object when username or password is not a string", () => {
    expect(basicStrategy.getHeaders({ username: 1, password: "p" })).toEqual({});
  });
});

describe("Auth registry", () => {
  it("getAuthStrategy returns strategy for bearer, api_key, basic", () => {
    expect(getAuthStrategy("bearer")).toBe(bearerStrategy);
    expect(getAuthStrategy("api_key")).toBe(apiKeyStrategy);
    expect(getAuthStrategy("basic")).toBe(basicStrategy);
  });

  it("getAuthStrategy returns undefined for unknown strategy", () => {
    expect(getAuthStrategy("unknown")).toBeUndefined();
    expect(getAuthStrategy("")).toBeUndefined();
  });

  it("getAuthHeaders returns headers for valid strategy and config", () => {
    expect(getAuthHeaders("bearer", { token: "t" })).toEqual({ Authorization: "Bearer t" });
    expect(getAuthHeaders("api_key", { api_key: "k" })).toEqual({ "X-API-Key": "k" });
  });

  it("getAuthHeaders returns empty object for unknown strategy", () => {
    expect(getAuthHeaders("unknown", { token: "t" })).toEqual({});
  });

  it("getAuthHeaders returns empty object when strategy returns no headers", () => {
    expect(getAuthHeaders("bearer", {})).toEqual({});
  });
});

describe("getAuthHeadersFromCapabilityConfig", () => {
  it("returns headers when config.auth.strategy and config.auth are set (Option A)", () => {
    const headers = getAuthHeadersFromCapabilityConfig({
      endpoint: "https://api.example.com",
      auth: { strategy: "bearer", token: "my-token" },
    });
    expect(headers).toEqual({ Authorization: "Bearer my-token" });
  });

  it("returns headers for api_key strategy from config.auth", () => {
    const headers = getAuthHeadersFromCapabilityConfig({
      auth: { strategy: "api_key", api_key: "key123", header: "X-Custom-Key" },
    });
    expect(headers).toEqual({ "X-Custom-Key": "key123" });
  });

  it("returns empty object when config is undefined or not an object", () => {
    expect(getAuthHeadersFromCapabilityConfig(undefined)).toEqual({});
    expect(getAuthHeadersFromCapabilityConfig(null as unknown as undefined)).toEqual({});
  });

  it("returns empty object when config has no auth and no api_key", () => {
    expect(getAuthHeadersFromCapabilityConfig({ endpoint: "https://x.com" })).toEqual({});
  });

  it("returns Bearer headers for legacy config.api_key (no config.auth)", () => {
    const headers = getAuthHeadersFromCapabilityConfig({
      endpoint: "https://api.example.com",
      api_key: "legacy-token",
    });
    expect(headers).toEqual({ Authorization: "Bearer legacy-token" });
  });

  it("ignores empty string api_key for legacy", () => {
    expect(
      getAuthHeadersFromCapabilityConfig({ api_key: "" })
    ).toEqual({});
  });
});
