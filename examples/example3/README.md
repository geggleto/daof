# example3 — 5 jokes, Content Editor picks one, publish to CLI and post to X

This example extends example2: the same **content_writer** and **content_editor** flow, plus a **publisher** that echoes the chosen joke to the CLI (**logger**) and posts it to X (**x_poster** using the Twitter API v2 SDK).

## Prerequisites

- Node 20+
- DAOF built from the repo root (`npm run build`) or installed
- **Redis** (for backbone; default `redis://localhost:6379`)
- **Cursor CLI** installed and on PATH ([install](https://cursor.com/docs/cli/installation)); the example uses the [headless CLI](https://cursor.com/docs/cli/headless) (`agent -p "..."`).
- **CURSOR_API_KEY** set in the environment (required for the Cursor CLI). Optional: **CURSOR_CLI_CMD** if the binary isn't named `agent` (e.g. full path).
- **Optional — real X posting:** To post tweets for real, set OAuth 1.0a credentials in the environment. The **x_poster** capability reads them from config (all use `env(...)`). If any is missing, the capability returns `{ post_id: "stub" }` and does not call the Twitter API. In the [X Developer Portal](https://developer.x.com) (your app → Keys and tokens):
  - `TWITTER_APP_KEY` — **API Key** (same as Consumer Key)
  - `TWITTER_APP_SECRET` — **API Key Secret** (Consumer Secret)
  - `TWITTER_ACCESS_TOKEN` — **Access Token**
  - `TWITTER_ACCESS_TOKEN_SECRET` — **Access Token Secret**
- **Dry-run:** Set `DRY_RUN=true` (or set `dry_run: true` in the x_poster config in org.yaml) to run the full workflow without posting to X; x_poster returns `{ post_id: "dry-run", dry_run: true }`.

### Local Redis (Docker)

From the repo root, start Redis with no auth (for local dev):

```bash
docker compose up -d
```

Stop with `docker compose down`. For hosted Redis (Upstash, Redis Cloud, etc.), use that URL in your org manifest instead.

## Commands

From the repo root:

```bash
daof validate examples/example3/org.yaml
daof run examples/example3/org.yaml
```

Or from this directory:

```bash
daof validate org.yaml
daof run org.yaml
```

- **Validate** checks the manifest schema.
- **Run** starts the org: without `--workflow`, the scheduler runs the heartbeat (cron workflows) and subscribes to the **events** queue. The `jokes_then_publish` workflow runs every minute; when it emits `tweet_posted`, the `process_tweet_metrics` workflow runs (event-driven).

To run a single workflow once (e.g. for testing):

```bash
daof run examples/example3/org.yaml --workflow jokes_then_publish
```

## What it does

- **content_writer** (provider: cursor, model: auto) — capability **text_generator**. Step 1: generates 5 short jokes (numbered 1–5, one per line).
- **content_editor** (provider: cursor, model: auto) — capability **text_generator**. Step 2: receives the 5 jokes via `{{ content_writer.text }}`, picks the single best one; output is stored as `content_editor.text`.
- **publisher** (provider: cursor, model: auto) — capabilities **logger**, **x_poster**, **tweet_post_store**, **event_emitter**. Step 3: **logger** echoes the chosen joke to stdout. Step 4: **x_poster** posts the tweet (or returns stub/dry-run). Step 5 (recorder): **tweet_post_record** builds `{ url, post_id, dry_run }` (stub URL is the DAOF intro tweet when dry-run/stub). Step 6: **tweet_post_store** persists that record under key `last_post`. Step 7: **event_emitter** publishes `tweet_posted` with the same payload to the backbone.
- **data_analyst** (provider: cursor, model: auto) — capabilities **tweet_post_store**, **tweet_metrics_processor**. The **process_tweet_metrics** workflow has trigger `event(tweet_posted)`. When the event is received, the data_analyst runs **tweet_metrics_processor** with the event payload; it skips when `dry_run` or `post_id` is stub/dry-run, otherwise calls **metrics_fetcher** for that post_id (stub returns zeros without an endpoint).
- The CLI prints the chosen joke during the run; use `-vvv` to print the full output JSON.
