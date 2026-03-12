import { describe, it, expect } from "vitest";
import { createAppCircuitBreaker } from "../src/fault/circuit-breaker.js";

describe("createAppCircuitBreaker", () => {
  it("returns an object with execute method", () => {
    const breaker = createAppCircuitBreaker();
    expect(breaker).toHaveProperty("execute");
    expect(typeof breaker.execute).toBe("function");
  });

  it("execute(resolvingFn) returns that result", async () => {
    const breaker = createAppCircuitBreaker();
    const result = await breaker.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("execute(throwingFn) propagates rejection", async () => {
    const breaker = createAppCircuitBreaker();
    const err = new Error("fail");
    await expect(breaker.execute(() => Promise.reject(err))).rejects.toThrow("fail");
  });
});
