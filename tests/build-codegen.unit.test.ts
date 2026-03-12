import { describe, it, expect } from "vitest";
import {
  capabilityIdToFactoryName,
  normalizeBundledExport,
} from "../src/build/codegen.js";

describe("capabilityIdToFactoryName", () => {
  it("converts single char to createXInstance", () => {
    expect(capabilityIdToFactoryName("x")).toBe("createXInstance");
  });

  it("converts snake_case to createPascalCaseInstance", () => {
    expect(capabilityIdToFactoryName("foo_bar")).toBe("createFooBarInstance");
  });

  it("converts multi-segment id", () => {
    expect(capabilityIdToFactoryName("my_capability_name")).toBe("createMyCapabilityNameInstance");
  });
});

describe("normalizeBundledExport", () => {
  it("returns usedNamedExport false when no default export", () => {
    const code = "export function foo() {}";
    const out = normalizeBundledExport(code, "createFooInstance");
    expect(out.usedNamedExport).toBe(false);
    expect(out.code).toBe(code);
  });

  it("replaces export default function with named export and renames in body", () => {
    const code = "export default function foo() {\n  return foo;\n}";
    const out = normalizeBundledExport(code, "createFooInstance");
    expect(out.usedNamedExport).toBe(true);
    expect(out.code).toContain("export function createFooInstance");
    expect(out.code).not.toContain("export default");
    expect(out.code).toContain("return createFooInstance");
  });
});
