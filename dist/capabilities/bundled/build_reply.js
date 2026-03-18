import { registerBundled } from "./registry.js";
const DEFAULT_BUILD_REPLIES_QUEUE = "build.replies";
function getQueueName(def) {
    const config = def.config;
    if (config &&
        typeof config === "object" &&
        "queue" in config &&
        typeof config.queue === "string") {
        return config.queue;
    }
    return DEFAULT_BUILD_REPLIES_QUEUE;
}
/**
 * Bundled build_reply capability. Input: { request_id, success, prd?, added_count?, error? }.
 * Publishes to backbone queue (default "build.replies") so the build client can correlate and unblock.
 * Output: { ok: true } or { ok: false, error }.
 */
export function createBuildReplyInstance(_capabilityId, def) {
    const queueName = getQueueName(def);
    return {
        async execute(input, runContext) {
            const requestId = input.request_id;
            if (requestId === undefined || requestId === null) {
                return { ok: false, error: "Missing request_id" };
            }
            if (!runContext?.backbone) {
                return { ok: false, error: "Build reply requires runContext.backbone" };
            }
            const success = input.success === true;
            const payload = {
                request_id: requestId,
                success,
                prd: input.prd,
                added_count: input.added_count,
                error: input.error,
            };
            try {
                await runContext.backbone.publish(queueName, payload);
                return { ok: true };
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return { ok: false, error };
            }
        },
    };
}
registerBundled("build_reply", createBuildReplyInstance);
//# sourceMappingURL=build_reply.js.map