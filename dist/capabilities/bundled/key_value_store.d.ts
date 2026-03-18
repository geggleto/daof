import type { CapabilityInstance } from "../../types/json.js";
import type { CapabilityDefinition } from "../../schema/index.js";
/**
 * Bundled KeyValueStore capability. Input: { operation: 'get'|'set'|'delete', key: string, value? }.
 * Output: get → { value }; set/delete → { ok: true }. Uses runContext.capabilityStore when present; otherwise in-memory fallback.
 */
export declare function createKeyValueStoreInstance(_capabilityId: string, _def: CapabilityDefinition): CapabilityInstance;
//# sourceMappingURL=key_value_store.d.ts.map