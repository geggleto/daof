import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolvePathUnderBase, sanitizeCapabilityIdForPath } from "../src/config/path-safety.js";

describe("resolvePathUnderBase", () => {
  let baseDir: string;

  beforeAll(() => {
    baseDir = mkdtempSync(join(tmpdir(), "daof-path-safety-"));
  });

  afterAll(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("returns resolved path when file is under base", () => {
    const result = resolvePathUnderBase("subdir/file.txt", baseDir);
    expect(result).toContain(baseDir);
    expect(result).toMatch(/subdir[\\/]file\.txt$/);
  });

  it("throws when path escapes base with ..", () => {
    expect(() => resolvePathUnderBase("../../../etc/passwd", baseDir)).toThrow(/escapes allowed base/);
  });

  it("throws when path escapes base with absolute-like segment", () => {
    expect(() => resolvePathUnderBase("sub/../../outside", baseDir)).toThrow(/escapes allowed base/);
  });

  it("accepts path that does not exist yet (for write)", () => {
    const result = resolvePathUnderBase("newdir/newfile.yaml", baseDir);
    expect(result).toContain(baseDir);
    expect(result).toMatch(/newdir[\\/]newfile\.yaml$/);
  });
});

describe("sanitizeCapabilityIdForPath", () => {
  it("accepts alphanumeric, underscore, hyphen", () => {
    expect(sanitizeCapabilityIdForPath("foo")).toBe("foo");
    expect(sanitizeCapabilityIdForPath("my_cap")).toBe("my_cap");
    expect(sanitizeCapabilityIdForPath("cap-1")).toBe("cap-1");
    expect(sanitizeCapabilityIdForPath("Cap1_2")).toBe("Cap1_2");
  });

  it("throws on empty string", () => {
    expect(() => sanitizeCapabilityIdForPath("")).toThrow(/non-empty string/);
  });

  it("throws when id contains path segments", () => {
    expect(() => sanitizeCapabilityIdForPath("../evil")).toThrow(/disallowed/);
    expect(() => sanitizeCapabilityIdForPath("foo/bar")).toThrow(/disallowed/);
    expect(() => sanitizeCapabilityIdForPath("foo.bar")).toThrow(/disallowed/);
  });

  it("throws when id contains backslash", () => {
    expect(() => sanitizeCapabilityIdForPath("foo\\bar")).toThrow(/disallowed/);
  });
});
