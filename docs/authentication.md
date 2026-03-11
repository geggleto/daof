# Authentication

Capabilities that call external systems use a **strategy/adapter pattern** for authentication. Each capability chooses an auth strategy by name and supplies strategy-specific config under `config.auth`. No single shared auth implementation; instead, pluggable strategies and a clear mapping from strategy name to implementation.

---

## Option A: Per-capability config (current)

In each capability's `config`, the manifest specifies which strategy to use and the credentials for it.

- **`config.auth.strategy`** — One of: `bearer`, `api_key`, `basic`.
- **`config.auth`** — Strategy-specific fields (see below). After loading, `resolveEnv` resolves any `env(VAR)` references at bootstrap.

Example:

```yaml
capabilities:
  image_generator:
    type: tool
    config:
      endpoint: "https://api.huggingface.co/..."
      auth:
        strategy: bearer
        token: env(HF_TOKEN)
  some_other:
    type: tool
    config:
      endpoint: "https://api.example.com/..."
      auth:
        strategy: api_key
        api_key: env(EXAMPLE_KEY)
        header: "X-API-Key"
```

The map is in the manifest: each capability's `config.auth.strategy` selects the strategy; the resolved `config.auth` (with env refs resolved) is passed to that strategy's `getHeaders(config.auth)` to produce HTTP headers.

---

## Strategy config shapes

| Strategy   | Config keys              | Notes |
|-----------|---------------------------|-------|
| **bearer** | `token` (required)        | Produces `Authorization: Bearer <token>`. |
| **api_key** | `api_key` (required), `header` (optional) | Default header name is `X-API-Key`. |
| **basic**  | `username`, `password` (required) | Produces `Authorization: Basic <base64(username:password)>`. |

---

## Secrets

- **Credentials must use `env(VAR)`** in the manifest. Do not put literal secrets in YAML.
- **ResolveEnv** resolves these at bootstrap so strategies receive plain values at runtime.
- **Do not log or echo** config that may contain credentials. Strategies return only headers; callers must not log auth config.

---

## Backward compatibility

If a capability has no `config.auth` but has top-level **`config.api_key`**, the registry treats it as **bearer** with that token so existing manifests keep working.

---

## Org-level auth profiles (deferred)

Org-level `auth_profiles` (Option B) are **not** implemented in this phase. They may be added later as a thin layer that resolves a profile name to a config blob and uses the same strategy registry.

---

## Example YAML snippets

**Bearer (e.g. Hugging Face):**

```yaml
config:
  endpoint: "https://api.huggingface.co/..."
  auth:
    strategy: bearer
    token: env(HF_TOKEN)
```

**API Key with custom header:**

```yaml
config:
  endpoint: "https://api.example.com/..."
  auth:
    strategy: api_key
    api_key: env(EXAMPLE_KEY)
    header: "X-API-Key"
```

**Basic auth:**

```yaml
config:
  endpoint: "https://internal.example.com/..."
  auth:
    strategy: basic
    username: env(SERVICE_USER)
    password: env(SERVICE_PASSWORD)
```

---

## Implementation

- **Types:** `src/capabilities/auth/types.ts` — `AuthStrategy` interface (`getHeaders(config)`).
- **Strategies:** `src/capabilities/auth/strategies/` — bearer, api_key, basic.
- **Registry:** `src/capabilities/auth/registry.ts` — strategy name → implementation, `getAuthStrategy`, `getAuthHeaders`, `getAuthHeadersFromCapabilityConfig`.
- Bundled HTTP capabilities (ImageGenerator, TextGenerator, SentimentAnalyzer, XPoster, MetricsFetcher, WebhookNotifier) use `getAuthHeadersFromCapabilityConfig(def.config)` and merge the result into fetch headers.
