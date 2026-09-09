# Prompt 057 - Webhook subscription temporal boundary

## Purpose

Prevent a webhook subscription from receiving an event that occurred before the subscription existed.

## Boundary

Webhook fan-out remains limited to subscriptions that are currently REGISTERED, belong to an ACTIVE integration client, include the event name, and existed at or before the event occurrence timestamp.

The queue boundary applies:

`subscription.createdAt <= event.occurredAt`

This protects both delayed transactional-outbox reconciliation and immediate enqueue paths from retroactively assigning historical events to newly created subscriptions.

## Non-goals

This slice does not replay historical events, revive revoked subscriptions, change retry/dead-letter behavior, add new event names, or grant any external write authority.

## Idempotency

The existing unique `(subscriptionId,eventId)` delivery constraint remains the duplicate-protection boundary. Existing delivery rows are not rewritten or removed by this change.
