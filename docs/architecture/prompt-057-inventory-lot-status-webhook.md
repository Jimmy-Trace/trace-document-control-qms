# Prompt 057 — Inventory lot status webhook event

## Purpose

Activate the already-approved `inventory.lot.status` webhook event using the shared transactional integration outbox.

## Source of truth

The producer is the append-only `MaterialLotStatusChange` ledger. Manual and automated inventory lifecycle changes already create rows in this table, so an `AFTER INSERT` trigger can record durable event intent in the same transaction as the governed status transition.

## Event identity

Each transition uses the deterministic event ID:

`inventory.lot.status:<materialLotStatusChangeId>`

The existing tenant/event uniqueness rule on `IntegrationWebhookOutbox` makes repeated publication idempotent.

## External payload

The payload is limited to:

- material lot ID
- material lot status-change ID
- prior status
- new status
- transition timestamp

The internal transition reason, actor identity, evidence, quantities, locations, audit metadata, and files are not included.

## Existing delivery controls

This producer reuses the existing webhook outbox reconciler and delivery worker, including HMAC signing, delivery-time public-address validation, no redirects, bounded payloads and timeouts, retry scheduling, and dead-letter handling.

No new integration scope, permission, event name, endpoint, or external write capability is introduced.
