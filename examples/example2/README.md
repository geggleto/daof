# example2 — 5 jokes, Content Editor picks one, publish to CLI

This example runs a **content_writer** that generates 5 jokes, a **content_editor** that picks the best one, and a **publisher** that echoes the chosen joke to the CLI using the **logger** capability.

## Prerequisites

- Node 20+
- DAOF built from the repo root (`npm run build`) or installed
- **Redis** (for backbone; default `redis://localhost:6379`)
- **Cursor CLI** installed and on PATH ([install](https://cursor.com/docs/cli/installation)); the example uses the [headless CLI](https://cursor.com/docs/cli/headless) (`agent -p "..."`).
- **CURSOR_API_KEY** set in the environment (required for the Cursor CLI). Optional: **CURSOR_CLI_CMD** if the binary isn't named `agent` (e.g. full path).

### Local Redis (Docker)

From the repo root, start Redis with no auth (for local dev):

```bash
docker compose up -d
```

Stop with `docker compose down`. For hosted Redis (Upstash, Redis Cloud, etc.), use that URL in your org manifest instead.

## Commands

From the repo root:

```bash
daof validate examples/example2/org.yaml
daof run examples/example2/org.yaml
```

Or from this directory:

```bash
daof validate org.yaml
daof run org.yaml
```

- **Validate** checks the manifest schema.
- **Run** starts the org: without `--workflow`, the scheduler runs all cron workflows. The `jokes_then_publish` workflow has trigger `cron(* * * * *)`, so it runs every minute.

To run a single workflow once (e.g. for testing):

```bash
daof run examples/example2/org.yaml --workflow jokes_then_publish
```

## What it does

- **content_writer** (provider: cursor, model: auto) — capability **text_generator**. Step 1: generates 5 short jokes (numbered 1–5, one per line).
- **content_editor** (provider: cursor, model: auto) — capability **text_generator**. Step 2: receives the 5 jokes via `{{ content_writer.text }}`, picks the single best one; output is stored as `content_editor.text`.
- **publisher** (provider: cursor, model: auto) — capability **logger**. Step 3: calls logger with `message: "{{ content_editor.text }}"` so the chosen joke is echoed to stdout. Using a separate publisher agent keeps `content_editor.text` in the final workflow context (same-agent steps overwrite context).
- The CLI prints the chosen joke during the run and then the full `result.context` JSON, including `content_editor.text` and `publisher: { ok: true }`.

## Example

When you run the workflow, the chosen joke is echoed to the CLI by the logger (step 3), then the full output is printed:

```
% daof run examples/example2/org.yaml --workflow jokes_then_publish
Why did the scarecrow win an award? He was outstanding in his field.
Workflow 'jokes_then_publish' completed. Success: true.
Output:
{
  "__initial": { "__run_id": "..." },
  "content_writer": { "text": "1. ...\n2. ...\n...", "__step_duration_ms": ... },
  "content_editor": { "text": "Why did the scarecrow win an award? ...", "__step_duration_ms": ... },
  "publisher": { "ok": true, "__step_duration_ms": ... }
}
```
