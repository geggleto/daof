import { describe, it, expect } from "vitest";
import { parseTrigger } from "../src/workflow/trigger.js";

describe("parseTrigger", () => {
  it("parses cron(0 9 * * *) to CronTrigger", () => {
    const result = parseTrigger("cron(0 9 * * *)");
    expect(result).toEqual({ type: "cron", expression: "0 9 * * *" });
  });

  it("parses cron with extra whitespace", () => {
    const result = parseTrigger("cron(  0 * * * *  )");
    expect(result).toEqual({ type: "cron", expression: "0 * * * *" });
  });

  it("parses event(strategy_ready) to EventTrigger", () => {
    const result = parseTrigger("event(strategy_ready)");
    expect(result).toEqual({ type: "event", eventName: "strategy_ready" });
  });

  it("parses event with whitespace", () => {
    const result = parseTrigger("event(  strategy_ready  )");
    expect(result).toEqual({ type: "event", eventName: "strategy_ready" });
  });

  it("throws for unsupported trigger format", () => {
    expect(() => parseTrigger("manual")).toThrow("Unsupported trigger format");
    expect(() => parseTrigger("")).toThrow("Unsupported trigger format");
  });
});
