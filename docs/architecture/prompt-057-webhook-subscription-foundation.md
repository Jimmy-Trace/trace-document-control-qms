# Prompt 057 — Webhook Subscription Foundation

## Scope

This slice introduces governed webhook subscription registration without introducing outbound delivery yet.

## Controls

- webhook administration requires the existing `integration.manage` human permission;
- every subscription is tenant-scoped and bound to an ACTIVE `IntegrationClient` in the same organization;
- callers cannot supply an organization identifier through the API;
- endpoint URLs must use HTTPS and may not contain embedded credentials;
- localhost and private/link-local literal IP destinations are rejected at registration;
- subscriptions use a server-owned event allow-list only;
- unknown events are rejected;
- registered subscriptions are immutable except for governed revocation;
- revocation requires a reason and records audit evidence;
- subscription creation records audit evidence;
- no signing secret is generated or stored in this slice because no outbound delivery path exists yet.

## Initial event registry

- `document.effective`
- `equipment.status`
- `inventory.lot.status`
- `quality_event.status`
- `validation_project.status`

These names map only to domains already exposed through reviewed Prompt 057 read-only reference APIs.

## SSRF boundary

Registration-time URL validation rejects obvious unsafe destinations. A future delivery slice must additionally resolve and re-check destination addresses at delivery time, enforce redirect policy, connection/time limits, payload size limits, and delivery-specific network controls before any outbound HTTP request is permitted.

## Boundary

This slice does not send webhooks, generate signing secrets, perform DNS resolution, follow redirects, retry deliveries, expose regulated payloads, or add inbound commands. Outbound delivery, signing, retry/dead-letter behavior, and delivery evidence require a separate reviewed slice.
