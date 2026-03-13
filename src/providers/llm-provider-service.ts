/**
 * Abstraction for provider execution. Capabilities that need to run the agent's LLM
 * depend only on this interface; provider-specific logic (CLI, HTTP, etc.) lives in
 * implementations.
 */
export interface LLMProviderService {
  complete(
    prompt: string,
    options?: { max_tokens?: number; model?: string }
  ): Promise<{ text: string } | { ok: false; error: string }>;
}
