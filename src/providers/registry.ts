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

const REGISTRY: Record<string, ProviderDefinition> = {};

const SERVICE_FACTORIES: Record<string, ProviderServiceFactory> = {};

/**
 * Register a provider definition (id + apiKeyEnvVar). Call from provider modules on load
 * so new providers can be added without editing this file. Built-ins register in register-providers.js.
 */
export function registerProviderDefinition(id: string, definition: ProviderDefinition): void {
  REGISTRY[id] = definition;
}

/** Returns the list of registered provider ids (computed from current registry). */
export function getKnownProviderIds(): string[] {
  return Object.keys(REGISTRY);
}

export function isKnownProvider(id: string): boolean {
  return id in REGISTRY;
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return REGISTRY[id];
}

/**
 * Returns the API key for the given provider from the environment, or undefined if not set.
 */
export function getProviderApiKey(providerId: string): string | undefined {
  const provider = getProvider(providerId);
  if (!provider) return undefined;
  return process.env[provider.apiKeyEnvVar];
}

/**
 * Register a provider execution factory. Call from provider implementation modules
 * (e.g. register-providers.ts) so getProviderService can instantiate the provider.
 */
export function registerProviderServiceFactory(
  providerId: string,
  factory: ProviderServiceFactory
): void {
  SERVICE_FACTORIES[providerId] = factory;
}

/**
 * Returns a provider execution service for the given provider id and API key.
 * Capabilities use this to run the agent's LLM without depending on provider-specific logic.
 */
export function getProviderService(
  providerId: string,
  apiKey: string | undefined
): LLMProviderService | undefined {
  if (!providerId || !apiKey) return undefined;
  const factory = SERVICE_FACTORIES[providerId];
  return factory?.(apiKey);
}
