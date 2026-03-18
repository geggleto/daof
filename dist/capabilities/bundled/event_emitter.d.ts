import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled EventEmitter capability. Input: { event_type, payload }. Output: { ok: true } or { ok: false, error }.
 * Publishes to backbone queue (default "events") with { event_type, payload }. Config can override queue name.
 */
export declare function createEventEmitterInstance(_capabilityId: string, def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=event_emitter.d.ts.map