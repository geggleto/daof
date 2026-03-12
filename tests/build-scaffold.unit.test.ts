import { describe, it, expect } from "vitest";
import { isENOENT, createScaffoldOrgConfig } from "../src/build/scaffold.js";

describe("isENOENT", () => {
  it("returns true for error with code ENOENT", () => {
    expect(isENOENT({ code: "ENOENT" })).toBe(true);
  });

  it("returns false for error with other code", () => {
    expect(isENOENT({ code: "OTHER" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isENOENT(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isENOENT(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isENOENT("ENOENT")).toBe(false);
  });
});

describe("createScaffoldOrgConfig", () => {
  it("returns valid OrgConfig with version, org, backbone.type", () => {
    const config = createScaffoldOrgConfig();
    expect(config.version).toBe("1.0");
    expect(config.org).toBeDefined();
    expect(config.org.name).toBe("Scaffold");
    expect(config.backbone.type).toBe("redis");
    expect(config.agents).toEqual({});
    expect(config.capabilities).toEqual({});
    expect(config.workflows).toEqual({});
  });
});
