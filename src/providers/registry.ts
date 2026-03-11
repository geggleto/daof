/**
 * Code-only provider registry. Defines known LLM providers and their API key env vars.
 * MVP: Cursor only. Add more providers by extending the registry.
 */

export interface ProviderDefinition {
  id: string;
  apiKeyEnvVar: string;
}

const REGISTRY: Record<string, ProviderDefinition> = {
  cursor: {
    id: "cursor",
    apiKeyEnvVar: "CURSOR_API_KEY",
  },
};

export const KNOWN_PROVIDER_IDS: string[] = Object.keys(REGISTRY);

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
