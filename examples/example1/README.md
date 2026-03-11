# example1 — One joke per minute (Cursor + text_generator)

This example runs a **content_writer** agent that generates one joke per minute using the **text_generator** capability and **Cursor** as the model provider.

## Prerequisites

- Node 20+
- DAOF built from the repo root (`npm run build`) or installed
- **Redis** (for backbone; default `redis://localhost:6379`)
- **Cursor CLI** installed and on PATH ([install](https://cursor.com/docs/cli/installation)); the example uses the [headless CLI](https://cursor.com/docs/cli/headless) (`agent -p "..."`).
- **CURSOR_API_KEY** set in the environment (required for the Cursor CLI). Optional: **CURSOR_CLI_CMD** if the binary isn’t named `agent` (e.g. full path).

### Local Redis (Docker)

From the repo root, start Redis with no auth (for local dev):

```bash
docker compose up -d
```

Stop with `docker compose down`. For hosted Redis (Upstash, Redis Cloud, etc.), use that URL in your org manifest instead.

## Commands

From the repo root:

```bash
daof validate examples/example1/org.yaml
daof run examples/example1/org.yaml
```

Or from this directory:

```bash
daof validate org.yaml
daof run org.yaml
```

- **Validate** checks the manifest schema.
- **Run** starts the org: without `--workflow`, the scheduler runs all cron workflows. The `joke_every_minute` workflow has trigger `cron(* * * * *)`, so it runs every minute.

To run a single workflow once (e.g. for testing):

```bash
daof run examples/example1/org.yaml --workflow joke_every_minute
```

## What it does

- One agent: **content_writer** (provider: cursor, model: auto), with capability **text_generator**.
- One workflow: **joke_every_minute** — every minute it runs one step that calls `text_generator` with prompt `"Tell one short joke."`.
- **text_generator** has no `config.endpoint`; the runtime uses **runContext.agentLlm** to run the Cursor headless CLI with `CURSOR_API_KEY` and returns the CLI stdout as the step output.

## Example
```
% node dist/cli/index.js run examples/example1/org.yaml --workflow joke_every_minute
Workflow 'joke_every_minute' completed. Success: true.
Output:
{
  "__initial": {
    "__run_id": "d58cb695-7991-45c4-a273-eedbb05449bd"
  },
  "content_writer": {
    "text": "Why do programmers prefer dark mode? Because light attracts bugs.",
    "__step_duration_ms": 5323
  }
}```