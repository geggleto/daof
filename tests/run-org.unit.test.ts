import { describe, it, expect, vi, afterEach } from "vitest";
import type { OrgRuntime } from "../src/runtime/bootstrap.js";
import { runScheduler } from "../src/runtime/run-org.js";
import * as parser from "../src/parser/index.js";

vi.mock("../src/parser/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof parser>();
  return {
    ...actual,
    writeOrgFile: vi.fn(),
  };
});

describe("runScheduler shutdown", () => {
  const writeOrgFileMock = vi.mocked(parser.writeOrgFile);

  afterEach(() => {
    vi.clearAllMocks();
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  it("when runtime.orgFilePath is set, calls writeOrgFile(runtime.orgFilePath, runtime.config) on SIGINT", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const config = {
      version: "1.0" as const,
      org: { name: "T", goals: [] },
      agents: {},
      capabilities: {},
      workflows: {},
      backbone: { type: "redis" as const, config: { url: "redis://localhost", queues: [] } },
    };
    const runtime: OrgRuntime = {
      config,
      capabilities: new Map(),
      agents: new Map(),
      orgFilePath: "/path/to/org.yaml",
    };
    await runScheduler(runtime, { onBeforeShutdown: () => {} });
    process.emit("SIGINT");
    expect(writeOrgFileMock).toHaveBeenCalledTimes(1);
    expect(writeOrgFileMock).toHaveBeenCalledWith("/path/to/org.yaml", config);
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("when runtime.orgFilePath is not set, does not call writeOrgFile on SIGINT", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    const config = {
      version: "1.0" as const,
      org: { name: "T", goals: [] },
      agents: {},
      capabilities: {},
      workflows: {},
      backbone: { type: "redis" as const, config: { url: "redis://localhost", queues: [] } },
    };
    const runtime: OrgRuntime = {
      config,
      capabilities: new Map(),
      agents: new Map(),
    };
    await runScheduler(runtime, { onBeforeShutdown: () => {} });
    process.emit("SIGINT");
    expect(writeOrgFileMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });
});
