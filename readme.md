# DAOF — Declarative Agentic Orchestration Framework

### **Build autonomous AI organizations with one YAML file.**

DAOF is used from the command line: `daof validate`, `daof run`, and `daof kill`. There is no server or library API for MVP; run everything via the `daof` CLI.

**For AI agents:** Before editing or reasoning about this codebase, read [AGENTS.md](AGENTS.md). It describes the project structure and points to the full API reference with types and signatures.

`org.yaml`
```yaml
# DAOF Manifest - v1.0
# This file completely defines an autonomous organization.
# Validate with: daof validate org.yaml
# Run with: daof run org.yaml (after validation)

version: "1.0"                     # Required - schema version for future compatibility
org:
  name: YGGMarketing               # Human-readable name
  description: >-
    Autonomous marketing team for YGG games. Generates content, posts to X, tracks engagement.
  goals:                           # High-level objectives (used by CEO/supervisor agents)
    - maximize_organic_engagement
    - stay_under_monthly_budget: 1500  # USD or API credits
    - maintain_brand_compliance

# ──────────────────────────────────────────────────────────────────────────────
# AGENTS
# Each agent is an LLM instance with a role and a set of capabilities it can use
# ──────────────────────────────────────────────────────────────────────────────
agents:
  ceo:
    provider: cursor                 # LLM provider (Cursor only for MVP; API key: CURSOR_API_KEY)
    model: auto                      # model id for that provider
    role: "Chief Executive Officer"
    description: Oversees budget, approves major strategies, monitors KPIs
    capabilities:
      - name: check_budget
      - name: alert_board
      - name: gitactor_scanner        # Reuse the scanner for output quality
    fallback: ceo_backup             # Optional: agent name to use if this one is offline
    max_concurrent_tasks: 3

  cmo:
    provider: cursor
    model: auto
    role: "Chief Marketing Officer"
    description: Defines per-game content strategy and asset volume
    capabilities:
      - name: generate_strategy
      - name: image_gen
      - name: gitactor_scanner
    max_concurrent_tasks: 5

  content_writer:
    provider: cursor
    model: auto
    role: "Content Writer"
    description: Generates captions, threads, blog posts
    capabilities:
      - name: gitactor_scanner        # Scan own output before passing downstream
      - name: text_formatter

  content_designer:
    provider: cursor
    model: auto
    role: "Content Designer"
    description: Creates images & short videos
    capabilities:
      - name: image_gen
      - name: video_gen_short
      - name: gitactor_scanner

  visual_qa:
    provider: cursor
    model: auto
    role: "Visual Quality Assurance"
    description: Reviews visuals for branding, errors, relevance
    capabilities:
      - name: gitactor_scanner

  compliance_qa:
    provider: cursor
    model: auto
    role: "Compliance & Legal QA"
    description: Checks for IP, spoilers, brand safety, legal risk
    capabilities:
      - name: gitactor_scanner

  content_manager:
    provider: cursor
    model: auto
    role: "Content Manager"
    description: Assembles final posts and publishes
    capabilities:
      - name: post_to_x
      - name: schedule_post
      - name: gitactor_scanner

  data_analyst:
    provider: cursor
    model: auto
    role: "Data Analyst"
    description: Collects X metrics hourly, generates insights
    capabilities:
      - name: get_x_metrics
      - name: upsert_metric
      - name: generate_report

# ──────────────────────────────────────────────────────────────────────────────
# CAPABILITIES
# Reusable building blocks (tools, skills, or hybrids) that agents can call.
# Capabilities can also call other capabilities via depends_on and runContext.invokeCapability — see [docs/capabilities.md](docs/capabilities.md) and [docs/workflow-engine.md](docs/workflow-engine.md).
# ──────────────────────────────────────────────────────────────────────────────
capabilities:
  image_gen:
    type: tool
    description: Generate images using Hugging Face endpoint
    config:
      endpoint: "https://your-flux-endpoint.hf.space"
      api_key: env(HF_API_KEY)
      default_batch_size: 5
      max_batch_size: 20
    persistence: sql_events          # Log every generation

  gitactor_scanner:
    type: tool
    description: Security & quality scan using gitactor.dev
    config:
      endpoint: "http://localhost:3000/scan"   # or hosted URL
      api_key: env(GITACTOR_API_KEY)
      default_mode: full
      auto_reject_threshold: 60
    persistence: sql_events

  post_to_x:
    type: tool
    description: Publish content to X
    config:
      api_key: env(X_API_KEY)
      api_secret: env(X_API_SECRET)
      access_token: env(X_ACCESS_TOKEN)
      access_secret: env(X_ACCESS_SECRET)
    rate_limit: 3 per minute

  # ... add more as needed

# ──────────────────────────────────────────────────────────────────────────────
# WORKFLOWS
# Named sequences of steps triggered by cron or events
# ──────────────────────────────────────────────────────────────────────────────
workflows:
  daily_content_cycle:
    trigger: cron(0 9 * * *)               # 9 AM daily
    description: Full daily content generation & posting
    persistence: sql_events                # Store checkpoints
    steps:
      - agent: ceo
        action: check_budget
        on_failure: alert_and_halt
      - agent: cmo
        action: generate_strategy
      - parallel:
          - agent: content_writer
            action: write_post
          - agent: content_designer
            action: generate_assets
            params:
              batch_size: "{{ cmo.recommended_variants }}"
      - agent: visual_qa
        action: review_assets
      - agent: compliance_qa
        action: final_compliance_check
      - agent: content_manager
        action: assemble_and_post
        condition: "{{ visual_qa.verdict == 'approve' && compliance_qa.verdict == 'approve' }}"

  hourly_metrics:
    trigger: cron(0 * * * *)
    description: Pull X metrics and store
    steps:
      - agent: data_analyst
        action: collect_metrics

# ──────────────────────────────────────────────────────────────────────────────
# BACKBONE & FAULT TOLERANCE
# ──────────────────────────────────────────────────────────────────────────────
backbone:
  type: redis                              # or rabbitmq, kafka
  config:
    url: redis://localhost:6379
    queues:
      - name: events
        type: pubsub
      - name: dlq
        type: fifo                         # dead-letter queue

fault_tolerance:
  health_checks_interval: 5m
  rogue_detection:
    - hallucination_guard
    - output_length_limit: 4000 chars
  retries:
    default: 3
    backoff: exponential
  circuit_breaker:
    threshold: 5 failures
    reset_after: 10m
  dead_letter_queue: true
  alerts:
    webhook: env(ALERT_WEBHOOK_URL)
    channels: [slack, email]
```

Then validate and run:
`daof validate org.yaml` — check your manifest is valid.
`daof run org.yaml` — start the org (when runtime is available).

And watch your fully autonomous marketing org come alive — agents strategizing, generating content, posting to X, tracking metrics, all while surviving crashes, hallucinations, API outages, and budget limits.
No more glue code. No more brittle agent scripts. No more "it worked on my machine" mornings.
DAOF is the missing piece between "cool agent demo" and "this thing runs my business 24/7 without babysitting.

### Quick Start (5 minutes)

1. Create org.yaml (copy the example above or use the generator).
2. Install DAOF (or build from repo: `npm run build`):

```bash
npm install -g daof
# or
bun add -g daof
```

3. Start Redis (required for `daof run`). From the repo root: `docker compose up -d`. Or use a hosted Redis URL in your manifest (e.g. Upstash, Redis Cloud).
4. Validate your manifest:

```bash
daof validate org.yaml
```

5. Run the org:

```bash
daof run org.yaml
```

To run a single workflow once: `daof run org.yaml --workflow hourly_metrics`.

That's it. Your agents are now alive, talking over queues, persisting state, checking each other for sanity, and doing real work.

### Documentation

- [docs/prd.md](docs/prd.md) — Product requirements and phases
- [docs/tip.md](docs/tip.md) — Technical implementation plan and manifest spec
- [docs/workflow-engine.md](docs/workflow-engine.md) — Workflow engine: inputs/outputs, types, templates, and API at a code/JSON level
- [docs/capabilities.md](docs/capabilities.md) — Capability-to-capability calls: depends_on and invokeCapability
- [docs/authentication.md](docs/authentication.md) — Authentication for external capabilities (strategy/adapter, per-capability config)
- [docs/backbone.md](docs/backbone.md) — Backbone (queues): adapter interface, Redis adapter, factory, and runtime integration
- [docs/verification.md](docs/verification.md) — Requirements traceability and verification

### Contributing
We want this to become the standard way people define agentic systems.

Got a killer capability? Submit a PR to the capability registry repo
Found a bug in fault handling? Issues welcome.
Want to add Kafka support or a new queue adapter? Fork & PR.

### License
MIT — free to use, fork, sell, embed, whatever.
Built with ❤️ by @geggleto + cursor + grok + community
Star the repo if you want to see this become the default way people run autonomous AI teams.
Let's make agent orchestration boringly reliable.