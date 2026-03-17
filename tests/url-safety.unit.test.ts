import { describe, it, expect } from "vitest";
import { isUrlAllowed } from "../src/config/url-safety.js";

describe("isUrlAllowed", () => {
  it("allows https URLs with public hostnames", () => {
    expect(isUrlAllowed("https://example.com/webhook")).toBe(true);
    expect(isUrlAllowed("https://api.example.org/path")).toBe(true);
  });

  it("rejects http by default", () => {
    expect(isUrlAllowed("http://example.com")).toBe(false);
  });

  it("allows http when allowHttp is true", () => {
    expect(isUrlAllowed("http://example.com", { allowHttp: true })).toBe(true);
  });

  it("rejects private and link-local hosts", () => {
    expect(isUrlAllowed("https://127.0.0.1/")).toBe(false);
    expect(isUrlAllowed("https://localhost/")).toBe(false);
    expect(isUrlAllowed("https://10.0.0.1/")).toBe(false);
    expect(isUrlAllowed("https://169.254.169.254/")).toBe(false);
    expect(isUrlAllowed("https://172.16.0.1/")).toBe(false);
    expect(isUrlAllowed("https://[::1]/")).toBe(false);
  });

  it("allows allowlisted host even if it would be blocked", () => {
    expect(isUrlAllowed("https://127.0.0.1/callback", { allowedHosts: ["127.0.0.1"] })).toBe(true);
  });

  it("rejects invalid URL", () => {
    expect(isUrlAllowed("not-a-url")).toBe(false);
    expect(isUrlAllowed("")).toBe(false);
  });

  it("rejects file and other schemes", () => {
    expect(isUrlAllowed("file:///etc/passwd")).toBe(false);
    expect(isUrlAllowed("ftp://example.com")).toBe(false);
  });
});
