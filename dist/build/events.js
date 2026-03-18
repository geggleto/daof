/**
 * Event-mode build: publish build.requested, wait for build.replies.
 */
import ora from "ora";
import { createBackbone } from "../backbone/factory.js";
import { resolveEnv } from "../config/resolve-env.js";
const DEFAULT_EVENTS_QUEUE = "events";
export const BUILD_REPLY_TIMEOUT_MS = 120_000;
export function getEventsQueueName(config) {
    const queues = config.backbone?.config?.queues;
    if (Array.isArray(queues)) {
        const named = queues.find((q) => q?.name === DEFAULT_EVENTS_QUEUE);
        if (named)
            return named.name;
        if (queues[0] && typeof queues[0].name === "string")
            return queues[0].name;
    }
    return DEFAULT_EVENTS_QUEUE;
}
export function randomRequestId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
/**
 * Run build in event mode: connect to backbone, publish build.requested,
 * wait for reply on build.replies (with timeout), return result.
 */
export async function runBuildViaEvents(description, orgFilePath, config, existingCapabilityIds, verbose) {
    const requestId = randomRequestId();
    const resolvedConfig = resolveEnv(config);
    const adapter = createBackbone(resolvedConfig.backbone);
    await adapter.connect();
    try {
        let resolveReply;
        const replyPromise = new Promise((resolve) => {
            resolveReply = resolve;
        });
        let unsub;
        const handler = (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.request_id === requestId) {
                    resolveReply(data);
                    unsub();
                }
            }
            catch {
                /* ignore */
            }
        };
        unsub = await adapter.subscribe("build.replies", handler);
        const eventsQueue = getEventsQueueName(config);
        await adapter.publish(eventsQueue, {
            event_type: "build.requested",
            payload: {
                description,
                request_id: requestId,
                org_path: orgFilePath,
                existing_capabilities: existingCapabilityIds,
            },
        });
        if (verbose >= 1)
            console.error("[build] Published build.requested, waiting for reply...");
        const waitSpinner = ora("Waiting for build reply…").start();
        let reply;
        try {
            reply = await Promise.race([
                replyPromise,
                new Promise((_, rej) => setTimeout(() => rej(new Error(`Build reply timeout (${BUILD_REPLY_TIMEOUT_MS / 1000}s). Is the org running (daof run)?`)), BUILD_REPLY_TIMEOUT_MS)),
            ]);
        }
        catch (err) {
            waitSpinner.fail("Timeout.");
            throw err;
        }
        const success = reply.success === true;
        const addedCount = typeof reply.added_count === "number" ? reply.added_count : 0;
        if (success) {
            waitSpinner.succeed("Build reply received.");
            if (verbose >= 1)
                console.error("[build] Build reply received (success).");
        }
        else {
            waitSpinner.fail("Build failed.");
            if (verbose >= 1)
                console.error("[build] Build reply received (failed).");
        }
        if (!success && typeof reply.error === "string") {
            return { success: false, error: new Error(reply.error) };
        }
        return { success, addedCount: success ? addedCount : undefined };
    }
    finally {
        await adapter.disconnect();
    }
}
//# sourceMappingURL=events.js.map