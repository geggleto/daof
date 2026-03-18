import { getBundledCapability } from "./bundled/index.js";
import { createSkillRunnerInstance } from "./bundled/skill_runner.js";
import { createInlineToolInstance } from "./adapters/inline-tool.js";
const typeResolverMap = {};
/**
 * Register a resolver for a capability definition type (e.g. "skill", "hybrid").
 * New types can be added without editing the default resolver chain.
 */
export function registerCapabilityTypeResolver(type, resolver) {
    typeResolverMap[type] = resolver;
}
function resolveByType(id, def) {
    const type = def.type ?? "tool";
    const resolver = typeResolverMap[type];
    return resolver ? resolver(id, def) : undefined;
}
registerCapabilityTypeResolver("skill", createSkillRunnerInstance);
/**
 * Default resolvers: try bundled, then type-based (e.g. skill), then inline-tool as catch-all.
 * Used when loadCapabilities is called without custom resolvers.
 */
export function getDefaultCapabilityResolvers() {
    return [
        (id, def) => getBundledCapability(id, def) ?? undefined,
        (id, def) => resolveByType(id, def),
        (id, def) => createInlineToolInstance(id, def),
    ];
}
//# sourceMappingURL=default-resolvers.js.map