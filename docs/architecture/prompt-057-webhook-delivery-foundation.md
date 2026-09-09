# Prompt 057 — Webhook Delivery Foundation

## Scope

This slice adds the controlled outbound-delivery mechanics for Prompt 057 webhook subscriptions. It does not wire QMS domain transactions directly to webhook publication and does not grant external systems any write authority.

## Delivery controls

- webhook events are queued per matching REGISTERED subscription with a caller-supplied idempotent event ID;
- `(subscriptionId,eventId)` is unique, preventing duplicate queue rows for the same event/subscription;
- payloads are JSON envelopes capped at 64 KiB and recorded with a SHA-256 payload hash;
- workers atomically claim due rows using `FOR UPDATE SKIP LOCKED` and a `PROCESSING` state before network activity;
- only REGISTERED subscriptions attached to ACTIVE integration clients may complete delivery;
- endpoints are revalidated at delivery time and must remain HTTPS;
- DNS is resolved immediately before delivery and any private, loopback, link-local, unspecified, or unique-local result is rejected;
- redirects are disabled (`manual`) so a validated public destination cannot redirect delivery into another network location;
- each request has a five-second timeout;
- successful delivery requires HTTP 2xx;
- failures retry with bounded backoff for no more than five total attempts;
- exhausted or administratively invalid deliveries become `DEAD_LETTER` rather than being discarded;
- worker invocation is protected by the existing `CRON_SECRET` bearer boundary.

## Signing

Webhook requests include:

- `X-Trace-Event-Id` — immutable event identifier;
- `X-Trace-Event` — server-owned event type;
- `X-Trace-Signature` — `v1=<hex HMAC-SHA256>` of the exact UTF-8 request body.

The signing secret is deterministically derived from `WEBHOOK_SIGNING_MASTER_SECRET`, subscription ID, and signing-key version. The master secret must contain at least 32 characters and must be stored only in the deployment secret manager. The derived receiver secret is returned when a subscription is created and is not stored as plaintext in the database.

Subscriptions created before this slice do not have a previously disclosed receiver secret. They should be revoked and re-created before outbound delivery is enabled for them.

## Queue boundary

`queueWebhookEvent(...)` is intentionally a service boundary rather than being inserted into existing QMS transactions in this slice. A later reviewed slice may publish specific domain events only after payload contracts and transactional outbox semantics are reviewed for each domain.

## Required environment

- `WEBHOOK_SIGNING_MASTER_SECRET` — at least 32 characters; required for new subscription secret disclosure and outbound signing.
- `CRON_SECRET` — existing protected worker credential.

## Explicit exclusions

This slice does not add inbound commands, external QMS writes, arbitrary event names, arbitrary payload construction by external callers, redirect following, unlimited retries, synchronous webhook calls inside regulated QMS transactions, or cross-tenant delivery.
