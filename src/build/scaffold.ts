/**
 * Scaffold org creation when the target org file does not exist.
 */
import { validate } from "../parser/index.js";
import type { OrgConfig } from "../schema/index.js";
import type { ParsedYaml } from "../types/json.js";

/** Minimal valid org used when the target org file does not exist. */
export function createScaffoldOrgConfig(): OrgConfig {
  return validate({
    version: "1.0",
    org: {
      name: "Scaffold",
      description: "Org created by daof build (scaffold)",
      goals: [],
    },
    agents: {},
    capabilities: {},
    workflows: {},
    backbone: {
      type: "redis",
      config: {
        url: "redis://localhost:6379",
        queues: [{ name: "events", type: "pubsub" }],
      },
    },
  } as unknown as ParsedYaml);
}

export function isENOENT(err: unknown): boolean {
  return err != null && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}
