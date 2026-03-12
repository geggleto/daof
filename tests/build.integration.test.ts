/**
 * Tests for daof build: Planner, Verifier, retry, merge, and --yolo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runBuild } from "../src/build/index.js";

// Control readline answer for "Proceed? (y/n)" (set per test)
(globalThis as { __buildTestReviewAnswer?: string }).__buildTestReviewAnswer = "y";

const mockComplete = vi.fn();
const createInterfaceMock = vi.fn();

vi.mock("../src/providers/registry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/providers/registry.js")>();
  return {
    ...actual,
    getProviderApiKey: vi.fn(() => "test-key"),
    getProviderService: vi.fn(() => ({
      complete: mockComplete,
    })),
  };
});

vi.mock("node:readline", () => ({
  createInterface: (...args: unknown[]) => {
    createInterfaceMock(...args);
    return {
      question: vi.fn((_q: string, cb: (answer: string) => void) => {
        const answer = (globalThis as { __buildTestReviewAnswer?: string }).__buildTestReviewAnswer ?? "y";
        cb(answer);
      }),
      close: vi.fn(),
    };
  },
}));

const MINIMAL_ORG_YAML = `version: "1.0"
org:
  name: Test
  goals: []
agents:
  content_writer:
    provider: cursor
    model: auto
    role: Content Writer
    capabilities:
      - name: text_generator
capabilities:
  text_generator:
    type: tool
    description: Generate text
workflows:
  joke_every_minute:
    trigger: cron(* * * * *)
    steps:
      - agent: content_writer
        action: text_generator
        params:
          prompt: Tell one short joke.
backbone:
  type: redis
  config:
    url: redis://localhost:6379
    queues:
      - name: events
        type: pubsub
`;

const VALID_GENERATOR_YAML = `capabilities:
  new_summarizer:
    type: skill
    description: Summarizes text
    prompt: "Summarize: {{ text }}"
agents: {}
workflows: {}
`;

function createTempOrgDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "daof-build-test-"));
  const orgPath = join(dir, "org.yaml");
  writeFileSync(orgPath, MINIMAL_ORG_YAML, "utf-8");
  return orgPath;
}

describe("daof build", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { __buildTestReviewAnswer?: string }).__buildTestReviewAnswer = "y";
  });

  describe("Planner", () => {
    it("invokes Planner with user description and uses PRD in flow", async () => {
      const orgPath = createTempOrgDir();
      mockComplete
        .mockResolvedValueOnce({ text: "PRD: Add a summarizer skill.\n" })
        .mockResolvedValueOnce({ text: VALID_GENERATOR_YAML })
        .mockResolvedValueOnce({ text: "PASS" });

      const result = await runBuild("add a skill that summarizes text", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(result.success).toBe(true);
      expect(result.addedCount).toBeGreaterThan(0);
      const firstCallPrompt = mockComplete.mock.calls[0]?.[0] ?? "";
      expect(firstCallPrompt).toContain("add a skill that summarizes text");
      expect(firstCallPrompt).toContain("Planner");
      expect(firstCallPrompt).toContain("PRD");
    });

    it("fails when Planner returns empty PRD", async () => {
      const orgPath = createTempOrgDir();
      mockComplete.mockResolvedValueOnce({ text: "   \n" });

      const result = await runBuild("do something", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toMatch(/empty PRD|Planner/i);
    });
  });

  describe("Verifier", () => {
    it("succeeds when Verifier returns PASS", async () => {
      const orgPath = createTempOrgDir();
      mockComplete
        .mockResolvedValueOnce({ text: "PRD: Add summarizer.\n" })
        .mockResolvedValueOnce({ text: VALID_GENERATOR_YAML })
        .mockResolvedValueOnce({ text: "PASS" });

      const result = await runBuild("summarizer", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
    });

    it("fails after 5 Verifier FAILs and returns error", async () => {
      const orgPath = createTempOrgDir();
      mockComplete.mockResolvedValueOnce({ text: "PRD: Add summarizer.\n" });
      for (let i = 0; i < 5; i++) {
        mockComplete.mockResolvedValueOnce({ text: VALID_GENERATOR_YAML });
        mockComplete.mockResolvedValueOnce({ text: "FAIL" });
      }

      const result = await runBuild("summarizer", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toMatch(/Verifier|retries|5/i);
    });
  });

  describe("retry", () => {
    it("retries on Verifier FAIL and eventually succeeds on PASS", async () => {
      const orgPath = createTempOrgDir();
      mockComplete.mockResolvedValueOnce({ text: "PRD: Add one capability.\n" });
      mockComplete.mockResolvedValueOnce({ text: VALID_GENERATOR_YAML });
      mockComplete.mockResolvedValueOnce({ text: "FAIL" });
      mockComplete.mockResolvedValueOnce({ text: VALID_GENERATOR_YAML });
      mockComplete.mockResolvedValueOnce({ text: "PASS" });

      const result = await runBuild("summarizer", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(result.success).toBe(true);
      expect(mockComplete).toHaveBeenCalledTimes(5); // 1 PRD + 2 attempts (gen+verify, gen+verify)
    });
  });

  describe("merge", () => {
    it("merges generated capabilities into existing org and preserves existing keys", async () => {
      const orgPath = createTempOrgDir();
      mockComplete
        .mockResolvedValueOnce({ text: "PRD: Add new_summarizer.\n" })
        .mockResolvedValueOnce({ text: VALID_GENERATOR_YAML })
        .mockResolvedValueOnce({ text: "PASS" });

      const beforeContent = readFileSync(orgPath, "utf-8");
      expect(beforeContent).toContain("text_generator");
      expect(beforeContent).not.toContain("new_summarizer");

      const result = await runBuild("summarizer", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(result.success).toBe(true);
      const afterContent = readFileSync(orgPath, "utf-8");
      expect(afterContent).toContain("text_generator");
      expect(afterContent).toContain("new_summarizer");
      expect(afterContent).toContain("Summarizes text");
    });
  });

  describe("--yolo", () => {
    it("skips review prompt when yolo is true (readline not used)", async () => {
      const orgPath = createTempOrgDir();
      mockComplete
        .mockResolvedValueOnce({ text: "PRD: Add summarizer.\n" })
        .mockResolvedValueOnce({ text: VALID_GENERATOR_YAML })
        .mockResolvedValueOnce({ text: "PASS" });

      await runBuild("summarizer", {
        orgFilePath: orgPath,
        yolo: true,
        providerId: "cursor",
      });

      expect(createInterfaceMock).not.toHaveBeenCalled();
    });

    it("when yolo is false and user says no, plan is discarded and nothing is written", async () => {
      const orgPath = createTempOrgDir();
      (globalThis as { __buildTestReviewAnswer?: string }).__buildTestReviewAnswer = "n";
      mockComplete.mockResolvedValueOnce({ text: "PRD: Add something.\n" });

      const beforeContent = readFileSync(orgPath, "utf-8");

      const result = await runBuild("add a thing", {
        orgFilePath: orgPath,
        yolo: false,
        providerId: "cursor",
      });

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(0);
      const afterContent = readFileSync(orgPath, "utf-8");
      expect(afterContent).toBe(beforeContent);
      expect(createInterfaceMock).toHaveBeenCalled();
    });

    it("when yolo is false and user says yes, build proceeds and writes", async () => {
      const orgPath = createTempOrgDir();
      (globalThis as { __buildTestReviewAnswer?: string }).__buildTestReviewAnswer = "y";
      mockComplete
        .mockResolvedValueOnce({ text: "PRD: Add summarizer.\n" })
        .mockResolvedValueOnce({ text: VALID_GENERATOR_YAML })
        .mockResolvedValueOnce({ text: "PASS" });

      const result = await runBuild("summarizer", {
        orgFilePath: orgPath,
        yolo: false,
        providerId: "cursor",
      });

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
      const afterContent = readFileSync(orgPath, "utf-8");
      expect(afterContent).toContain("new_summarizer");
    });
  });
});
