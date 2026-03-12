import { describe, it, expect } from "vitest";
import { parseYamlString, stringifyToYaml } from "../src/parser/index.js";

describe("parseYamlString", () => {
  it("parses valid YAML to object", () => {
    const result = parseYamlString("key: 1");
    expect(result).toEqual({ key: 1 });
  });

  it("parses multi-line YAML", () => {
    const result = parseYamlString("a: 1\nb: 2");
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("throws on invalid YAML", () => {
    expect(() => parseYamlString("invalid: [")).toThrow();
  });
});

describe("stringifyToYaml", () => {
  it("serializes object to YAML string containing keys and values", () => {
    const out = stringifyToYaml({ a: 1 });
    expect(out).toContain("a");
    expect(out).toContain("1");
  });

  it("round-trips with parseYamlString", () => {
    const obj = { key: 1, nested: { x: "y" } };
    const yaml = stringifyToYaml(obj);
    const back = parseYamlString(yaml);
    expect(back).toEqual(obj);
  });
});
