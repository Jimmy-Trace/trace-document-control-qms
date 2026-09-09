# Prompt 057 — Transactional webhook outbox

## Purpose

Close the commit-then-enqueue reliability gap for the approved `document.effective` webhook event without placing outbound network activity inside regulated QMS transactions.

## Transactional guarantee

Migration `0071_transactional_webhook_outbox` adds `IntegrationWebhookOutbox` and an `AFTER UPDATE OF status` trigger on `DocumentVersion`.

When a controlled document version changes to `EFFECTIVE`, the same database transaction inserts one durable event intent with deterministic event ID:

`document.effective:<documentVersionId>`

The outbox row contains only the approved metadata payload: document ID, document version ID, EFFECTIVE status, and effective timestamp. No document content, hashes, signatures, review comments, workflow evidence, file bytes, or user identities are included.

A tenant/event unique index and `ON CONFLICT DO NOTHING` make repeated trigger execution idempotent.

## Reconciliation

The protected webhook worker processes the transactional outbox before delivery records.

For each due unpublished outbox row it calls the existing governed `queueWebhookEvent(...)` function. That function remains responsible for approved-event validation, active tenant subscription selection, the 64 KiB payload ceiling, SHA-256 payload evidence, and per-subscription event idempotency.

After queueing succeeds, the outbox row is marked published. If the process crashes after queueing but before marking the outbox row published, the next reconciliation attempt is safe because `IntegrationWebhookDelivery` already enforces uniqueness on `(subscriptionId,eventId)`.

Failed reconciliation attempts retain the durable outbox row, record bounded error text, and schedule a retry. Event intent is not deleted or converted into a terminal state by this layer.

## Existing low-latency publication

The application-level post-transition `queueWebhookEvent(...)` call remains in place as a low-latency optimization. It is no longer the sole durability mechanism. If it succeeds first, later outbox reconciliation is an idempotent no-op at the delivery-row boundary and then marks the outbox intent published.

## Security boundary

This slice adds no new external scope, permission, endpoint, event type, or write capability. Outbound HTTP remains exclusively in the existing delivery worker and therefore remains subject to HMAC signing, delivery-time DNS/public-address checks, redirect refusal, timeout limits, retry controls, and dead-letter handling.
