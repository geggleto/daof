# Providers and provider service layer

Provider execution is behind a **service layer**: capabilities that need to run the agent’s LLM depend on an abstraction (`LLMProviderService`), not on a specific provider. Each provider (e.g. Cursor) encapsulates its own execution logic (CLI command, spawn, env).

- **Interface:** `LLMProviderService` in `src/providers/llm-provider-service.ts` — method `complete(prompt, options?)` returning `{ text }` or `{ ok: false, error }`.
- **Registry:** `getProviderService(providerId, apiKey)` in `src/providers/registry.ts` returns the implementation for the given provider (or `undefined` if unknown or missing API key). Providers register via `registerProviderServiceFactory(providerId, factory)`; `src/providers/register-providers.ts` registers Cursor and is imported at app entry (CLI and programmatic index) so no edit to the registry is needed to add a new provider—only a new implementation and a line in `register-providers.ts`.
- **Cursor** is one implementation: `src/providers/cursor-service.ts` owns CLI binary (default `agent`, override via `CURSOR_CLI_CMD`), spawn, args, and env (`CURSOR_API_KEY`). The bundled **text_generator** capability uses `getProviderService` and `service.complete()` when no `config.endpoint` is set; it does not reference Cursor or CLI details directly.

Adding a new provider means implementing `LLMProviderService`, calling `registerProviderServiceFactory("new-id", createNewProviderService)` (e.g. from `register-providers.ts`), and ensuring that module is loaded at entry; capabilities like text_generator stay unchanged.
