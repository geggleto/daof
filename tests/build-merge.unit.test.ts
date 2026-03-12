import { describe, it, expect } from "vitest";
import {
  stripCodeFence,
  stripMarkdownLines,
  looksLikeYamlContent,
  findMentionedYamlPath,
  extractYamlFromMarkdown,
  extractCodeBlock,
  extractGenerated,
  mergeIntoConfig,
} from "../src/build/merge.js";
import type { OrgConfig } from "../src/schema/index.js";

describe("stripCodeFence", () => {
  it("returns content inside first fenced code block", () => {
    const text = "```\ninner\ncontent\n```";
    expect(stripCodeFence(text)).toBe("inner\ncontent");
  });

  it("returns trimmed content when no fence", () => {
    expect(stripCodeFence("  plain text  ")).toBe("plain text");
  });

  it("returns original when closing fence missing", () => {
    expect(stripCodeFence("```\nno close")).toBe("```\nno close");
  });
});

describe("stripMarkdownLines", () => {
  it("strips **bold** header lines", () => {
    const text = "**Capabilities**\ncapabilities:\n  x: 1";
    expect(stripMarkdownLines(text)).toBe("capabilities:\n  x: 1");
  });

  it("strips # heading lines", () => {
    const text = "# Title\ncapabilities:\n  a: 1";
    expect(stripMarkdownLines(text)).toContain("capabilities:");
  });

  it("strips ``` fence lines", () => {
    const text = "```yaml\nkey: 1\n```";
    expect(stripMarkdownLines(text)).not.toContain("```");
  });
});

describe("looksLikeYamlContent", () => {
  it("returns true when starts with capabilities:", () => {
    expect(looksLikeYamlContent("capabilities:\n  x: 1")).toBe(true);
  });

  it("returns true when starts with agents:", () => {
    expect(looksLikeYamlContent("agents:\n  a: {}")).toBe(true);
  });

  it("returns true when has comment then capabilities:", () => {
    expect(looksLikeYamlContent("# Generated\ncapabilities:\n  x: 1")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(looksLikeYamlContent("Hello world")).toBe(false);
  });
});

describe("findMentionedYamlPath", () => {
  it("returns path from backticks", () => {
    expect(findMentionedYamlPath("See `path/to/file.yaml`")).toBe("path/to/file.yaml");
  });

  it("returns path from generated at pattern", () => {
    expect(findMentionedYamlPath("Generated at out/generated.yml")).toBe("out/generated.yml");
  });

  it("returns undefined when no yaml path", () => {
    expect(findMentionedYamlPath("No path here")).toBeUndefined();
  });
});

describe("extractYamlFromMarkdown", () => {
  it("extracts yaml from fenced block", () => {
    const md = "Some text\n```yaml\ncapabilities:\n  x: 1\n```";
    const out = extractYamlFromMarkdown(md);
    expect(out).toContain("capabilities:");
    expect(out).toContain("x: 1");
  });

  it("returns fallback when no block", () => {
    const text = "capabilities:\n  a: 1";
    expect(extractYamlFromMarkdown(text)).toContain("capabilities:");
  });
});

describe("extractCodeBlock", () => {
  it("returns first code block when no preferLang", () => {
    const md = "```\nconst x = 1;\n```";
    expect(extractCodeBlock(md)).toBe("const x = 1;");
  });

  it("returns typescript block when preferLang typescript", () => {
    const md = "```js\nnope\n```\n```typescript\nconst a = 1;\n```";
    expect(extractCodeBlock(md, "typescript")).toBe("const a = 1;");
  });

  it("returns undefined for empty string", () => {
    expect(extractCodeBlock("")).toBeUndefined();
  });
});

describe("extractGenerated", () => {
  it("returns capabilities, agents, workflows from object", () => {
    const parsed = {
      capabilities: { cap1: { type: "tool" } },
      agents: { a1: {} },
      workflows: {},
    };
    const out = extractGenerated(parsed);
    expect(out.capabilities).toEqual({ cap1: { type: "tool" } });
    expect(out.agents).toEqual({ a1: {} });
    expect(out.workflows).toEqual({});
  });

  it("returns empty objects for null", () => {
    const out = extractGenerated(null);
    expect(out).toEqual({ capabilities: {}, agents: {}, workflows: {} });
  });

  it("returns empty objects for array input", () => {
    const out = extractGenerated([]);
    expect(out).toEqual({ capabilities: {}, agents: {}, workflows: {} });
  });
});

describe("mergeIntoConfig", () => {
  it("merges generated into existing config", () => {
    const config = {
      version: "1.0",
      org: { name: "O", goals: [] },
      agents: { existing: {} },
      capabilities: { existing: {} },
      workflows: {},
      backbone: { type: "redis" as const, config: { url: "redis://x", queues: [] } },
    } as OrgConfig;
    const generated = {
      capabilities: { new_cap: {} },
      agents: { new_agent: {} },
      workflows: { new_w: {} },
    };
    const merged = mergeIntoConfig(config, generated);
    expect(merged.capabilities).toHaveProperty("existing");
    expect(merged.capabilities).toHaveProperty("new_cap");
    expect(merged.agents).toHaveProperty("new_agent");
    expect(merged.workflows).toHaveProperty("new_w");
  });
});
