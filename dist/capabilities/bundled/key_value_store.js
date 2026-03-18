import { registerBundled } from "./registry.js";
const OPS = ["get", "set", "delete"];
function isOp(s) {
    return OPS.includes(s);
}
/** In-memory fallback when runContext.capabilityStore is not available (e.g. no Redis). */
const memoryFallback = new Map();
/**
 * Bundled KeyValueStore capability. Input: { operation: 'get'|'set'|'delete', key: string, value? }.
 * Output: get → { value }; set/delete → { ok: true }. Uses runContext.capabilityStore when present; otherwise in-memory fallback.
 */
export function createKeyValueStoreInstance(_capabilityId, _def) {
    return {
        async execute(input, runContext) {
            const op = typeof input.operation === "string" && isOp(input.operation) ? input.operation : null;
            const key = typeof input.key === "string" ? input.key : "";
            if (!op) {
                return { ok: false, error: "Invalid or missing operation; use get, set, or delete" };
            }
            if (!key) {
                return { ok: false, error: "Missing key" };
            }
            const store = runContext?.capabilityStore;
            const getVal = () => store ? store.get(key) : Promise.resolve(memoryFallback.get(key) ?? null);
            const setVal = (value) => {
                if (store)
                    return store.set(key, value);
                memoryFallback.set(key, value);
                return Promise.resolve();
            };
            const delVal = () => {
                if (store)
                    return store.delete(key);
                memoryFallback.delete(key);
                return Promise.resolve();
            };
            if (op === "get") {
                const value = await getVal();
                return { value: value ?? null };
            }
            if (op === "set") {
                const value = input.value;
                if (value === undefined) {
                    return { ok: false, error: "Missing value for set" };
                }
                await setVal(value);
                return { ok: true };
            }
            await delVal();
            return { ok: true };
        },
    };
}
registerBundled("key_value_store", createKeyValueStoreInstance);
//# sourceMappingURL=key_value_store.js.map