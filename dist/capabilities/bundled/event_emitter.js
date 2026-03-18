import { registerBundled } from "./registry.js";
function getQueueName(def) {
    const config = def.config;
    if (config && typeof config === "object" && "queue" in config && typeof config.queue === "string") {
        return config.queue;
    }
    return "events";
}
/**
 * Bundled EventEmitter capability. Input: { event_type, payload }. Output: { ok: true } or { ok: false, error }.
 * Publishes to backbone queue (default "events") with { event_type, payload }. Config can override queue name.
 */
export function createEventEmitterInstance(_capabilityId, def) {
    const queueName = getQueueName(def);
    return {
        async execute(input, runContext) {
            const eventType = typeof input.event_type === "string" ? input.event_type : "event";
            const payload = input.payload ?? {};
            try {
                if (runContext?.backbone) {
                    await runContext.backbone.publish(queueName, { event_type: eventType, payload });
                }
                return { ok: true };
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                return { ok: false, error };
            }
        },
    };
}
registerBundled("event_emitter", createEventEmitterInstance);
//# sourceMappingURL=event_emitter.js.map