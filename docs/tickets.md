# Ticketing (workflow run observability)

Tickets give you a trace of what happened during a workflow run. **One ticket per run**: when a workflow starts, a ticket is created in MongoDB; when the run finishes (success or failure), the ticket status is updated. Agents and capabilities can append updates to the ticket via `RunContext.ticket`, so you can see who did what and when.

## Requirements

- **MongoDB is required** for running workflows. The same Mongo connection is used for the registry and the ticket store. Configure `registry.mongo_uri` in the org manifest or set `REGISTRY_MONGO_URI` / `MONGO_URI` (default `mongodb://localhost:27017`).

## Ticket ID

The ticket ID is the **run ID** (the same UUID used for the LangGraph thread and for `daof kill <run_id>`). After a workflow run, the CLI prints:

```
Ticket ID: <run_id>
```

Use that ID to look up the ticket.

## Looking up a ticket

```bash
daof ticket <ticket_id>
```

This loads the ticket from MongoDB and prints:

- Ticket ID, workflow ID, status, created/updated timestamps
- A list of **updates**: each update has a timestamp, optional agent/capability/step, message, and optional payload

Optional: `daof ticket <id> --mongo-uri <uri>` to use a different Mongo URI.

## Appending updates from capabilities

When a capability runs as part of a workflow step, `RunContext` may include a **ticket** facade:

```ts
runContext.ticket?.append({
  message: "Step completed",
  agent_id: "planner",
  capability_id: "produce_prd",
  step: "produce_prd",
  payload: { prd_length: 123 },
});
```

- **id:** `runContext.ticket.id` is the run/ticket ID.
- **append(update):** Appends an update to the ticket. Fields: `agent_id?`, `capability_id?`, `step?`, `message?`, `payload?` (JSON). The store adds `at` (ISO timestamp) automatically.

If the runtime has no ticket store or the step is not part of a workflow run, `runContext.ticket` is undefined.

## Storage

- **Database:** `daof_tickets` (default).
- **Collection:** `tickets`.
- **Document:** `_id` (ticket/run id), `workflow_id`, `run_id`, `status` (`running` | `completed` | `failed`), `created_at`, `updated_at`, `updates[]`, optional `initial_input`.

See [src/tickets/types.ts](../src/tickets/types.ts) and [src/tickets/ticket-store.ts](../src/tickets/ticket-store.ts).
