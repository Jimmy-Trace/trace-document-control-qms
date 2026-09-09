# Prompt 057 — Document effective webhook event

## Scope

This slice wires the approved `document.effective` domain event into the governed webhook delivery foundation after a successful controlled document transition to `EFFECTIVE`.

## Event contract

The event ID is deterministic: `document.effective:<documentVersionId>`. The existing delivery queue uniqueness rule on subscription plus event ID therefore prevents duplicate delivery records for repeated publication attempts.

The payload is intentionally metadata-only:

- `documentId`
- `documentVersionId`
- `status` = `EFFECTIVE`
- `effectiveAt`

The event does not contain controlled document content, file bytes, content hashes, signatures, review comments, workflow evidence, user identities, or tenant identifiers supplied by an external caller.

## Publication boundary

`DocumentCommandService` publishes the event only after the lifecycle store confirms a successful `MAKE_EFFECTIVE` transition. The publisher is injectable for focused testing and defaults to the existing `queueWebhookEvent(...)` service.

`queueWebhookEvent(...)` persists delivery queue records only. It performs no outbound HTTP request. Actual network delivery remains isolated in the CRON-protected webhook delivery worker added by the preceding Prompt 057 slice.

Publication errors are not swallowed. This avoids falsely reporting successful integration publication when the queue insert failed. Because lifecycle persistence and webhook queue persistence currently use separate database calls, durable reconciliation of a transition that committed immediately before an enqueue failure remains a separate Prompt 057 reliability slice.

## Governance boundary

- no new integration scope or permission
- no external write capability
- no arbitrary event names
- no synchronous outbound network call during document lifecycle processing
- no widening of the `document.effective` payload beyond controlled reference metadata
- no wiring of equipment, inventory, quality-event, or validation-project events in this slice
