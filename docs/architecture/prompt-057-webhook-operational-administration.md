# Prompt 057 — Webhook Operational Administration

## Scope

This slice adds administrator-safe webhook delivery diagnostics and controlled dead-letter requeue. It does not introduce new integration scopes, event names, public integration write capability, or payload recovery.

## Diagnostics boundary

Administrators with `integration.manage` may inspect tenant-scoped delivery metadata: integration client identity/name, subscription ID, event ID/name, delivery status, attempt count, timing fields, HTTP response status, and bounded last-error text.

Webhook payload bodies and payload hashes are not returned by this administration endpoint. Results are capped at 100 rows and sorted newest first.

## Dead-letter requeue

Only a delivery currently in `DEAD_LETTER` may be requeued, and only while its subscription remains `REGISTERED` and its integration client remains `ACTIVE`.

Requeue requires an explicit reason. The delivery row is locked, reset to `PENDING`, its attempt counter and execution-result fields are cleared, and it becomes due immediately for the existing governed delivery worker.

The same database transaction writes append-only `INTEGRATION_WEBHOOK_DELIVERY_REQUEUED` audit evidence. Audit metadata preserves the prior attempt count, response status, and prior error text together with the event/subscription identifiers before those mutable execution fields are reset.

## Security and governance

- `integration.manage` remains required.
- Tenant scope is enforced in both diagnostic reads and requeue writes.
- No webhook payload, signing secret, integration credential, or credential hash is exposed.
- Revoked subscriptions or integration clients cannot be used to resume outbound delivery.
- Requeue does not bypass endpoint safety, HMAC signing, timeout, retry, or dead-letter controls; the existing worker applies those controls again.
