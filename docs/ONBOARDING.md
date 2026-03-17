# DAOF onboarding

This guide is for first-time users. By the end you will have validated an org manifest, run a workflow once, and optionally run the scheduler or try a build.

---

## Prerequisites

- **Node 20+** — Check with `node -v`.
- **Redis** — Required for `daof run` (scheduler and event workflows). Use Docker Compose from the repo or a hosted Redis URL.
- **Cursor API key** — Set `CURSOR_API_KEY` for LLM-backed workflows and for `daof build` / `daof plan`.
- **MongoDB (optional)** — Needed for the registry and ticket store when you run workflows. You can defer this and use the minimal example first; see the [readme](../readme.md) for `REGISTRY_MONGO_URI` / `MONGO_URI`.

---

## Step 1 — Install

Install the CLI globally:

```bash
npm install -g daof
```

Or from the repo: run `npm install` at the repo root, then use `npx daof` or `node_modules/.bin/daof`.

Check that it works:

```bash
daof --help
daof validate --help
```

---

## Step 2 — Environment

Create a `.env` file in your working directory (e.g. repo root). The CLI loads `.env` and `.env.local` from the current working directory.

Minimum for the minimal example:

```
CURSOR_API_KEY=your_cursor_api_key
```

For workflows that use the registry or tickets, set `REGISTRY_MONGO_URI` or `MONGO_URI` (default `mongodb://localhost:27017`). See the [readme](../readme.md) for the full list of environment variables.

---

## Step 3 — Get an org manifest

Use the minimal example so you can validate and run without extra setup. From the repo root:

```bash
cd examples/example1
```

This org has one agent and one cron workflow that runs every minute. The manifest is `org.yaml` in that directory.

---

## Step 4 — Start Redis

From the repo root (not from `examples/example1`):

```bash
docker compose up -d
```

Or use a hosted Redis and set the URL in the org manifest (`backbone.config.url`).

To confirm Redis is up:

```bash
redis-cli ping
```

You should see `PONG`.

---

## Step 5 — Validate

From `examples/example1` (or from repo root with the path to the manifest):

```bash
daof validate org.yaml
```

Expected output:

```
Valid. (org: Example1).
```

If you see schema or YAML errors, fix the manifest or use the example as-is.

---

## Step 6 — Run one workflow

Run the workflow once and exit so you see output without starting the scheduler:

```bash
daof run org.yaml --workflow joke_every_minute
```

You should see the workflow start, the agent step run (text_generator), and then the process exit. With `-v` or `-vv` you get more detail; `-vvv` prints workflow output JSON.

---

## Step 7 — Run the scheduler (optional)

To run the full scheduler (heartbeat, cron, and event subscriber):

```bash
daof run org.yaml
```

The cron in example1 fires every minute. Press Ctrl+C to stop. The manifest is kept in memory; changes from workflows are written back to the file on shutdown.

To run in the background: `daof run org.yaml -d` and optionally `--pid-file <path>`. See the [CLI reference](../readme.md#cli-reference) for details.

---

## Step 8 — First build (optional)

Build generates capabilities, workflows, and agents from a natural-language description (Planner → review → Generator → merge). From the repo root, using the root `org.yaml`:

```bash
daof build "Add a simple logger" --yolo --file org.yaml
```

Use `--yolo` to skip the PRD review step. For the full flow and event-based builds, see [Build flow](build-flow.md).

---

## Where to go next

| Link | Description |
|------|-------------|
| [readme — CLI reference](../readme.md#cli-reference) | All `daof` commands and options. |
| [Workflow engine](workflow-engine.md) | Triggers, daemon mode, runWorkflow. |
| [Capabilities](capabilities.md) | Tools, skills, depends_on, invokeCapability. |
| [Build flow](build-flow.md) | Planner, Generator, merge, Verifier, event mode. |
| [examples/](../examples/) | More example org manifests. |
