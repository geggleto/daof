import { describe, it, expect } from "vitest";
import {
  resolveTemplate,
  resolveParams,
  evaluateCondition,
} from "../src/workflow/context.js";
import type { WorkflowContext } from "../src/workflow/types.js";

describe("workflow context", () => {
  describe("resolveTemplate", () => {
    it("replaces {{ agentId.key }} with value from context", () => {
      const context: WorkflowContext = {
        cmo: { recommended_variants: ["a", "b"] },
      };
      expect(resolveTemplate(context, "Use {{ cmo.recommended_variants }}")).toBe(
        "Use a,b"
      );
    });

    it("replaces multiple placeholders", () => {
      const context: WorkflowContext = {
        a: { x: "1" },
        b: { y: "2" },
      };
      expect(resolveTemplate(context, "{{ a.x }} and {{ b.y }}")).toBe("1 and 2");
    });

    it("uses empty string when agent output is missing", () => {
      const context: WorkflowContext = {};
      expect(resolveTemplate(context, "{{ missing.foo }}")).toBe("");
    });

    it("uses empty string when key is missing on output", () => {
      const context: WorkflowContext = { a: { x: 1 } };
      expect(resolveTemplate(context, "{{ a.nonexistent }}")).toBe("");
    });

    it("resolves nested path agentId.key1.key2", () => {
      const context: WorkflowContext = {
        a: { nested: { value: "deep" } },
      };
      expect(resolveTemplate(context, "{{ a.nested.value }}")).toBe("deep");
    });
  });

  describe("resolveParams", () => {
    it("resolves string values with templates", () => {
      const context: WorkflowContext = { cmo: { id: "123" } };
      expect(resolveParams(context, { ref: "{{ cmo.id }}" })).toEqual({
        ref: "123",
      });
    });

    it("recursively resolves nested objects", () => {
      const context: WorkflowContext = { a: { x: "v" } };
      expect(
        resolveParams(context, { outer: { inner: "{{ a.x }}" } })
      ).toEqual({ outer: { inner: "v" } });
    });

    it("leaves non-string primitives unchanged", () => {
      const context: WorkflowContext = {};
      expect(resolveParams(context, { n: 1, b: true })).toEqual({ n: 1, b: true });
    });
  });

  describe("evaluateCondition", () => {
    it("returns true for empty or whitespace condition", () => {
      const context: WorkflowContext = {};
      expect(evaluateCondition(context, "")).toBe(true);
      expect(evaluateCondition(context, "   ")).toBe(true);
    });

    it("returns true when context path is truthy", () => {
      const context: WorkflowContext = {
        visual_qa: { verdict: "approve" },
      };
      expect(evaluateCondition(context, "{{ visual_qa.verdict }}")).toBe(true);
    });

    it("returns false when condition has no valid {{ path }} template", () => {
      const context: WorkflowContext = {};
      expect(evaluateCondition(context, "no_template_here")).toBe(false);
    });

    it("returns false when agent output is missing", () => {
      const context: WorkflowContext = {};
      expect(evaluateCondition(context, "{{ missing.foo }}")).toBe(false);
    });

    it("returns false when value is false, 0, or empty string", () => {
      const context: WorkflowContext = {
        a: { flag: false },
        b: { n: 0 },
        c: { s: "" },
      };
      expect(evaluateCondition(context, "{{ a.flag }}")).toBe(false);
      expect(evaluateCondition(context, "{{ b.n }}")).toBe(false);
      expect(evaluateCondition(context, "{{ c.s }}")).toBe(false);
    });

    it("returns true only when all && parts are truthy", () => {
      const context: WorkflowContext = {
        a: { ok: true },
        b: { ok: true },
      };
      expect(
        evaluateCondition(context, "{{ a.ok }} && {{ b.ok }}")
      ).toBe(true);
    });

    it("returns false when one part in && is falsy", () => {
      const context: WorkflowContext = {
        a: { ok: true },
        b: { ok: false },
      };
      expect(
        evaluateCondition(context, "{{ a.ok }} && {{ b.ok }}")
      ).toBe(false);
    });
  });
});
