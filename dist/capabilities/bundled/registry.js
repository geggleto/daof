const registry = {};
export function registerBundled(capabilityId, factory) {
    registry[capabilityId] = factory;
}
export function getBundledCapability(capabilityId, def) {
    const factory = registry[capabilityId];
    if (!factory)
        return undefined;
    return factory(capabilityId, def);
}
export function getBundledIds() {
    return new Set(Object.keys(registry));
}
//# sourceMappingURL=registry.js.map