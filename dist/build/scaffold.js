/**
 * Scaffold org creation when the target org file does not exist.
 */
import { validate } from "../parser/index.js";
/** Minimal valid org used when the target org file does not exist. */
export function createScaffoldOrgConfig() {
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
    });
}
export function isENOENT(err) {
    return err != null && typeof err === "object" && "code" in err && err.code === "ENOENT";
}
//# sourceMappingURL=scaffold.js.map