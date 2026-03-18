import { registerBundled } from "./registry.js";
// ... recommendation types and parsing ...
export function createApplyCapabilityUpgradeInstance(_capabilityId, _def) {
    return {
        async execute(input, runContext) {
            // TODO
            // 1. Get recommendations from input or invoke recommend_upgrades
            // 2. Categorize: add_capability → build.requested event
            //                update_config / model_upgrade → direct YAML patch
            // 3. Emit build.requested via event_emitter for new capabilities
            // 4. Load, patch, validate, write org for config/model changes
            // 5. Return summary with applied count and errors
            return { ok: true };
        },
    };
}
registerBundled("apply_capability_upgrade", createApplyCapabilityUpgradeInstance);
//# sourceMappingURL=apply_capability_upgrade.js.map