const REGISTRY = {};
const SERVICE_FACTORIES = {};
/**
 * Register a provider definition (id + apiKeyEnvVar). Call from provider modules on load
 * so new providers can be added without editing this file. Built-ins register in register-providers.js.
 */
export function registerProviderDefinition(id, definition) {
    REGISTRY[id] = definition;
}
/** Returns the list of registered provider ids (computed from current registry). */
export function getKnownProviderIds() {
    return Object.keys(REGISTRY);
}
export function isKnownProvider(id) {
    return id in REGISTRY;
}
export function getProvider(id) {
    return REGISTRY[id];
}
/**
 * Returns the API key for the given provider from the environment, or undefined if not set.
 */
export function getProviderApiKey(providerId) {
    const provider = getProvider(providerId);
    if (!provider)
        return undefined;
    return process.env[provider.apiKeyEnvVar];
}
/**
 * Register a provider execution factory. Call from provider implementation modules
 * (e.g. register-providers.ts) so getProviderService can instantiate the provider.
 */
export function registerProviderServiceFactory(providerId, factory) {
    SERVICE_FACTORIES[providerId] = factory;
}
/**
 * Returns a provider execution service for the given provider id and API key.
 * Capabilities use this to run the agent's LLM without depending on provider-specific logic.
 */
export function getProviderService(providerId, apiKey) {
    if (!providerId || !apiKey)
        return undefined;
    const factory = SERVICE_FACTORIES[providerId];
    return factory?.(apiKey);
}
//# sourceMappingURL=registry.js.map