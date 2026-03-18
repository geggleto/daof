import type { LLMProviderService } from "./llm-provider-service.js";
/**
 * Code-only provider registry. Defines known LLM providers and their API key env vars.
 * Provider execution services register via registerProviderServiceFactory; add new
 * providers by creating an implementation and registering it (e.g. in register-providers.ts).
 */
export interface ProviderDefinition {
    id: string;
    apiKeyEnvVar: string;
}
export type ProviderServiceFactory = (apiKey: string) => LLMProviderService;
/**
 * Register a provider definition (id + apiKeyEnvVar). Call from provider modules on load
 * so new providers can be added without editing this file. Built-ins register in register-providers.js.
 */
export declare function registerProviderDefinition(id: string, definition: ProviderDefinition): void;
/** Returns the list of registered provider ids (computed from current registry). */
export declare function getKnownProviderIds(): string[];
export declare function isKnownProvider(id: string): boolean;
export declare function getProvider(id: string): ProviderDefinition | undefined;
/**
 * Returns the API key for the given provider from the environment, or undefined if not set.
 */
export declare function getProviderApiKey(providerId: string): string | undefined;
/**
 * Register a provider execution factory. Call from provider implementation modules
 * (e.g. register-providers.ts) so getProviderService can instantiate the provider.
 */
export declare function registerProviderServiceFactory(providerId: string, factory: ProviderServiceFactory): void;
/**
 * Returns a provider execution service for the given provider id and API key.
 * Capabilities use this to run the agent's LLM without depending on provider-specific logic.
 */
export declare function getProviderService(providerId: string, apiKey: string | undefined): LLMProviderService | undefined;
//# sourceMappingURL=registry.d.ts.map