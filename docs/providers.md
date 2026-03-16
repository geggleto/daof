# Providers and provider service layer

Provider execution is behind a **service layer**: capabilities that need to run the agent’s LLM depend on an abstraction (`LLMProviderService`), not on a specific provider. Each provider (e.g. Cursor) encapsulates its own execution logic (CLI command, spawn, env).

- **Interface:** `LLMProviderService` in `src/providers/llm-provider-service.ts` — method `complete(prompt, options?)` returning `{ text }` or `{ ok: false, error }`.
- **Registry:** `getProviderService(providerId, apiKey)` in `src/providers/registry.ts` returns the implementation for the given provider (or `undefined` if unknown or missing API key). Providers register via `registerProviderServiceFactory(providerId, factory)`; `src/providers/register-providers.ts` registers Cursor and is imported at app entry (CLI and programmatic index) so no edit to the registry is needed to add a new provider—only a new implementation and a line in `register-providers.ts`.
- **Cursor** is one implementation: `src/providers/cursor-service.ts` owns CLI binary (default `agent`, override via `CURSOR_CLI_CMD`), spawn, and args. The API key is passed to the child process both via the **`--api-key`** CLI flag (so the subprocess always receives it when spawned in parallel) and via the `CURSOR_API_KEY` env var. The bundled **text_generator** capability uses `getProviderService` and `service.complete()` when no `config.endpoint` is set; it does not reference Cursor or CLI details directly.

### Cursor authentication

The Cursor CLI is invoked with `CURSOR_API_KEY` in the environment. If you see an error like **"Password not found for account 'cursor-user' and service 'cursor-access-token'"**, the CLI is falling back to the system keychain and failing. Fix it by setting the API key so the subprocess gets it:

1. **Set `CURSOR_API_KEY`** in `.env` or `.env.local` in the directory from which you run `daof` (e.g. project root). The CLI loads these automatically.
2. Or **export** it in your shell: `export CURSOR_API_KEY=your_key` before running `daof run ...`.

Use a valid Cursor API key (from your Cursor account/settings). After setting it, re-run the workflow.

Adding a new provider means implementing `LLMProviderService`, calling `registerProviderServiceFactory("new-id", createNewProviderService)` (e.g. from `register-providers.ts`), and ensuring that module is loaded at entry; capabilities like text_generator stay unchanged.
