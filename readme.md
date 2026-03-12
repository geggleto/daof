# DAOF — Declarative Agentic Orchestration Framework

<image-card alt="DAOF" src="https://img.shields.io/badge/DAOF-v0.1-orange" ></image-card>
<image-card alt="License" src="https://img.shields.io/github/license/geggleto/daof" ></image-card>
<image-card alt="Stars" src="https://img.shields.io/github/stars/geggleto/daof?style=social" ></image-card>
<image-card alt="Forks" src="https://img.shields.io/github/forks/geggleto/daof?style=social" ></image-card>

![DAOF in Action](demo.gif)

### **Build autonomous AI organizations with one YAML file.**

Build autonomous AI organizations with one YAML file. No glue code. No babysitting.

### Install

```bash
npm install -g daof
```

Or use it in a project: `npm install daof` and run via `npx daof` or `node_modules/.bin/daof`. Requires Node 20+.

### Usage

DAOF is used from the command line: `daof validate`, `daof run`, `daof kill`, `daof plan`, and `daof build`. There is no server or library API for MVP; run everything via the `daof` CLI.

**Planning interactively:** Use `daof plan [description]` to run only the Planner and interactively refine a PRD. You can revise the PRD (via natural-language feedback), save it to a file, or execute the full build with the current PRD. Use `--no-edit` for a one-shot PRD (no loop); add `--execute` to run the full build with that PRD.

**Generating capabilities:** Use `daof build "<description>"` to generate capabilities, workflows, and agents from a natural-language description. The Planner produces a PRD, you review (y/n), then the Generator merges new definitions into your org manifest (default: `org.yaml` in the current directory). Use `--yolo` to skip the review step. See [docs/capabilities.md](docs/capabilities.md#generating-capabilities).

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

### Extend the framework
```bash
node dist/cli/index.js build "Add a capability that allows an agent to write principal level frontend code" \
  --file org.example.yaml \          
  --yolo --bundle
✔ Planner done.
--- PRD ---
---

## PRD: Principal-Level Frontend Code Writer

### Summary

Add a capability that enables an agent to generate production-grade, architecturally sound frontend code at a principal-engineer level of quality. This includes component architecture, state management, accessibility, performance optimization, and adherence to modern frontend best practices.

### What will be generated

#### Capabilities (1 new)

| ID | Type | Description |
|----|------|-------------|
| `frontend_code_writer` | skill | Accepts a task description (and optional tech stack, constraints, existing code context) and produces principal-quality frontend code. The prompt template enforces principal-engineer standards: component decomposition, semantic HTML, accessibility (WCAG 2.1 AA), performance-conscious rendering, proper TypeScript typing, idiomatic state management, error boundaries, and test scaffolding. Uses `config.endpoint` (same LLM provider as org) for generation. |

**Prompt emphasis areas** (encoded in the skill prompt template):
- Clean component architecture with single-responsibility, composability, and clear prop contracts.
- TypeScript strict mode; no `any` types; discriminated unions where appropriate.
- Accessibility-first markup (ARIA, keyboard navigation, focus management).
- Performance patterns (memoization, lazy loading, virtualization guidance when relevant).
- Idiomatic CSS/styling approach (CSS modules, Tailwind, or styled-components — caller-specified).
- Error handling (error boundaries, graceful degradation, loading/empty states).
- Testability (co-located test outline or hook extraction for unit testing).

**Inputs:**
- `task` (required) — natural-language description of the frontend feature or component.
- `stack` (optional) — framework/library preferences (e.g. `"React 18, TypeScript, Tailwind"`). Defaults to React + TypeScript.
- `context` (optional) — existing code or architectural context to align with.
- `constraints` (optional) — additional constraints (e.g. `"must support SSR"`, `"no external state library"`).

**Output:** `{ text }` — the generated code with inline explanations of architectural decisions where non-obvious.

#### Agents (1 new)

| ID | Role | Capabilities | Description |
|----|------|-------------|-------------|
| `frontend_engineer` | Principal Frontend Engineer | `frontend_code_writer`, `logger` | Writes production-grade frontend code on demand. Can be assigned to workflow steps that require frontend implementation. |

#### Workflows (0 new)

No new workflow is proposed. The `frontend_engineer` agent and `frontend_code_writer` capability are available for use in existing or future workflows. Users can invoke the agent in any workflow step via `action: frontend_code_writer`.

### Existing capabilities reused

- `logger` — attached to the new agent for observability.
- `text_generator` — **not** depended on directly; the skill uses its own `config.endpoint` for LLM calls (same pattern).

### Out of scope

- File-system write (the capability returns code as text; a separate capability or workflow step handles persistence).
- Automated test execution or CI integration.
- Backend code generation.
-----------
✔ Generator done.
✔ Similarity check done.
✔ Generator done.
✔ Similarity check done.
✔ Generator done.
✔ Similarity check done.
✔ Generator done.
✔ Similarity check done.
✔ Merge done. Added 2 definition(s).
✔ Verifier pass.
Added 2 capability/agent/workflow definition(s) to org.example.yaml.
```

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