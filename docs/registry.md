# Skills and Capabilities Registry

The **registry** is a MongoDB-backed store for capability and agent definitions with **metadata search fields** (tags, category, intent). It is used to:

- Keep a record of org structure (archive) and support “existing” capability lists when the org is reset or minimal.
- Let agents query by metadata (e.g. `query_capability_registry`) to discover existing skills/capabilities and avoid proposing duplicates.
- Drive the **duplication check** in the build flow: metadata-based matches (registry) are combined with the LLM similarity check (`verify_similarity`).

## Configuration

- **Connection:** Env `REGISTRY_MONGO_URI` or `MONGO_URI`; or in the org manifest under **`registry.mongo_uri`** (optional). Default for local dev: `mongodb://localhost:27017`, database `daof_registry`.
- **Docker:** Use the `mongo` service in [docker-compose.yml](../docker-compose.yml) for local development (`mongo:7`, port 27017). For production, use a secured MongoDB and set `REGISTRY_MONGO_URI`.

## Metadata in the manifest

Capabilities and agents can declare optional **metadata** in the org YAML for search and deduplication:

- **tags:** `string[]` — e.g. `["image", "huggingface", "http"]`
- **category:** `string` — e.g. `"content"`, `"metrics"`
- **intent:** `string` — short normalized intent, e.g. `"generate images via HTTP"`

For agents, **role_category** is also supported. Metadata can be specified in YAML or derived by a **tag/metadata skill** (e.g. `suggest_capability_metadata`) during `daof registry sync` or in the build flow.

## CLI

- **`daof registry sync --file <path>`** — Load the org manifest, then upsert every capability and agent into the registry with metadata from the YAML (tags, category, intent / role_category). Use this to archive the current org or seed the registry after adding metadata.
- **`daof registry query --tags "image,http"`** — Query the registry by tags (comma-separated); prints matching `capability_ids` and `agent_ids`.
- **`daof registry query --category "content"`** — Query by category.
- **`daof registry query`** — With no options, lists all capability and agent ids in the registry.

## Build flow integration

- **Existing capabilities:** When the registry is available (MongoDB config present and connection succeeds), the build flow merges **existing capability ids** from the org with those from `registry.listAll()`. The Planner and Generator receive this merged list so they know what already exists.
- **Duplication check:** Before the LLM similarity check, the build runs **registry duplicate check** when `runtime.registry` is set: for each proposed capability/agent, it queries the registry by metadata (tags, category). If a registry entry matches, the pair is reported as a duplicate. Registry duplicates and LLM similarity duplicates are merged; if any duplicates are found, the build fails with a clear message.

## Query capability

The bundled capability **`query_capability_registry`** can be used by agents (e.g. Planner or Generator in a workflow). Input: `{ tags?: string[], category?: string, match_all_tags?: boolean }`. Output: `{ capability_ids: string[], agent_ids: string[] }`. It uses `runContext.registry`; if the registry is not connected, it returns `{ ok: false, error: "..." }`.

## Staleness and archiving

Each registry entry has:

- **`last_accessed`** — ISO timestamp. Updated whenever the entry is **fetched** via `getCapability(id)` or `getAgent(id)`. Used to determine staleness (entries not accessed within a window are considered stale).
- **`archived_at`** — ISO timestamp. Set when the entry is **pruned** by the Curator. Archived entries are **excluded** from `listAll`, `queryByTags`, `queryByCategory`, and from the build flow’s “existing” capability list. They remain in the store for audit or restore.

Entries with no `last_accessed` use `updated_at` as the fallback for staleness. “Stale” = `last_accessed` (or `updated_at`) older than a configurable number of days.

## Prune capability and Curator agent

The bundled capability **`prune_registry`** lists stale entries and, unless `dry_run` is true, **archives** them (sets `archived_at` and `source: "archive"`). Input: `{ older_than_days?: number; dry_run?: boolean }` (default `older_than_days: 90`, `dry_run: false`). Output: `{ ok: true, archived_capability_ids, archived_agent_ids, dry_run }` or `{ ok: false, error }`. Requires `runContext.registry`.

Define a **Curator** agent in the org manifest with capability **`prune_registry`**, and a workflow (e.g. **registry_curation**) that runs on a schedule (e.g. weekly cron) and invokes the Curator with `prune_registry` and params like `{ older_than_days: 90 }`. Example in [org.yaml](../org.yaml): agent **curator**, workflow **registry_curation** (`cron(0 3 * * 0)`).

## Runtime

When the org is bootstrapped, the runtime tries to connect to MongoDB (using `REGISTRY_MONGO_URI` or org `registry.mongo_uri`). On success, **`runtime.registry`** is set and passed into **RunContext** so capabilities (e.g. `query_capability_registry`) can query the registry. Connection failure is non-fatal: the registry is left undefined and the org runs without registry features.
