# Accepted and residual risks

This document lists security risks that have been **accepted** (rather than mitigated) for the DAOF codebase. It is informed by the aggregated security audit (see `findings/aggregated-security-audit-8821c335-ca5d-49d1-bd90-3ceb59c84803.md`, 2025-03-16 UTC).

---

## Accepted risks

### Finding 1: CLI file path (High)

The CLI accepts a file path (e.g. `daof validate <file>`, `daof run <file>`, `daof build --file <path>`) without path normalization or containment. A path such as `../../../etc/passwd` could be used to read arbitrary files if the argument is user- or script-supplied.

**Mitigation:** None. **Operational guidance:** Only pass org file paths you trust. Do not use user- or script-supplied paths from untrusted sources when invoking the CLI.

---

### Finding 9: Logger and ticket data exposure (Low)

The bundled Logger capability logs `message` and `metadata` from capability input to the console. Ticket updates appended via `RunContext.ticket.append()` are stored in MongoDB and displayed in full by `daof ticket <id>`. If a workflow passes sensitive data (e.g. API keys, PII) into the logger or into ticket updates, that data will appear in logs or in the ticket output.

**Mitigation:** None. **Operational guidance:** Do not pass secrets or PII into the Logger capability or into ticket update message/payload. Workflow authors must ensure step outputs containing secrets are not forwarded to the logger or ticket updates.

---

## Residual risk

Path and URL mitigations (capability source containment, file_uploader, merge_and_write, webhook_notifier, codegen, build flow) reduce but do not eliminate risk when running orgs from untrusted or less-trusted sources. Operators should only run manifests and workflows they trust.
