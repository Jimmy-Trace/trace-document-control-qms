# Prompt 057 — Validation project status webhook event

## Scope

This slice activates the already-approved `validation_project.status` webhook using the shared durable integration outbox.

## Governed source

The event is sourced from `ValidationProjectActionEvent`, the append-only validation lifecycle ledger. The validation service writes the Validation Project status update and the corresponding action-event row in the same database transaction, so the webhook intent is created transactionally with the governed lifecycle transition.

The deterministic event ID is:

`validation_project.status:<validationProjectActionEventId>`

This gives each start, completion, or cancellation transition its own durable identity.

## External payload

Only lifecycle metadata is exported:

- `validationProjectId`
- `statusChangeId`
- `fromStatus`
- `toStatus`
- `changedAt`

The external payload does not include project title/objective, lifecycle reason, actor identity, criteria, acceptance rules, results, observed results, evidence-file references, method details, audit metadata, or files.

## Reliability and security boundary

- `validation_project.status` already exists on the server-owned webhook allow-list.
- No new integration permission or scope is introduced.
- No external write capability or new public endpoint is added.
- The outbox insert uses the existing organization/event uniqueness contract, so retries are idempotent.
- The existing reconciler and delivery worker continue to provide signing, delivery-time destination validation, timeout, retry, and dead-letter controls.
