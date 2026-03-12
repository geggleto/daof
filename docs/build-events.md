# Build events

When the org is running (`daof run`), build can be triggered by publishing a **build.requested** event on the backbone. The org runs the build workflow (Planner → Generator → merge → Verifier) and publishes the result to **build.replies**. The CLI can use **`daof build "description" --via-events`** to publish and wait for the reply (no interactive review).

## Event: build.requested

- **Where:** Published to the **events** queue (the same queue the scheduler subscribes to for event-triggered workflows).
- **Message shape:** JSON with `event_type` and `payload`:

```json
{
  "event_type": "build.requested",
  "payload": {
    "description": "add a skill that summarizes text",
    "request_id": "uuid-or-unique-string",
    "org_path": "org.yaml",
    "existing_capabilities": ["logger", "text_generator"]
  }
}
```

- **Payload fields:**
  - **description** (string): User request for what to generate.
  - **request_id** (string): Unique id used to correlate the reply; the reply will include this so the client can match.
  - **org_path** (string, optional): Path to the org manifest to update; if omitted the workflow may use a default or fail.
  - **existing_capabilities** (array of strings, optional): Capability ids already in the org so the Generator does not duplicate them.

The scheduler runs any workflow whose trigger is **`event(build.requested)`** with `initialInput = { ...payload, __event_id }`.

## Reply: build.replies queue

- **Where:** A dedicated **build.replies** queue (fifo). Add it to the backbone config in the org manifest:

```yaml
backbone:
  type: redis
  config:
    url: redis://localhost:6379
    queues:
      - name: events
        type: pubsub
      - name: build.replies
        type: fifo
```

- **Message shape:** One JSON message per build reply, with `request_id` so the client can correlate:

```json
{
  "request_id": "uuid-or-unique-string",
  "success": true,
  "prd": "PRD text...",
  "added_count": 2,
  "error": null
}
```

- **Fields:**
  - **request_id** (string): Same as in the request.
  - **success** (boolean): Whether the build (merge + verify) succeeded.
  - **prd** (string, optional): The PRD produced by the Planner.
  - **added_count** (number, optional): Number of capabilities/agents/workflows added.
  - **error** (string, optional): Error message when `success` is false.

The workflow uses the **build_reply** capability (or event_emitter with queue `build.replies`) to publish this after the Verifier step.

## Workflow: build_on_request

Define a workflow that runs when `build.requested` is received, e.g.:

```yaml
workflows:
  build_on_request:
    trigger: event(build.requested)
    description: "Self-upgrade; run Planner, Generator, merge, Verifier, reply."
    steps:
      - agent: planner
        action: produce_prd
        params:
          description: "{{ __initial.description }}"
      - agent: generator
        action: generate_yaml
        params:
          description: "{{ __initial.description }}"
          prd: "{{ planner.prd }}"
          existing_capabilities: "{{ __initial.existing_capabilities }}"
      - agent: builder
        action: merge_and_write
        params:
          org_path: "{{ __initial.org_path }}"
          generated_yaml: "{{ generator.yaml }}"
      - agent: verifier
        action: verify_build
        params:
          prd: "{{ planner.prd }}"
          summary: "{{ builder.summary }}"
      - agent: builder
        action: build_reply
        params:
          request_id: "{{ __initial.request_id }}"
          success: "{{ verifier.pass }}"
          prd: "{{ planner.prd }}"
          added_count: "{{ builder.added_count }}"
```

The org must define **planner**, **generator**, **builder**, and **verifier** agents and the capabilities **produce_prd**, **generate_yaml**, **merge_and_write**, **verify_build**, **build_reply**. See [org.example.yaml](../org.example.yaml) for a full example.

## CLI: --via-events

- **`daof build "<description>" --via-events`**  
  Connects to the backbone (from the org manifest), subscribes to `build.replies`, publishes `build.requested` with a generated `request_id` and payload (`description`, `org_path` from `--file`, `existing_capabilities` from the loaded org), and waits for a reply with matching `request_id` (timeout 120s). No interactive “Proceed? (y/n)” — effectively **--yolo** for event mode.
- Requires **backbone** config in the org and a **build.replies** queue. The org must be **running** (`daof run`) in another process to handle the event.

## Related

- [build-flow.md](build-flow.md) — Full build flow and in-process vs event mode
- [backbone.md](backbone.md) — Queue config and adapter interface
