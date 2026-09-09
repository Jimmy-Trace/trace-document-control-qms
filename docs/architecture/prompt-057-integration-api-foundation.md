# Prompt 057 — Integration & API Management Foundation

## Scope

This foundation implements the first controlled external-integration boundary required by the approved integration architecture. It does not expose regulated QMS records for mutation and does not introduce direct database sharing.

## Controls

- external integrations use tenant-scoped `IntegrationClient` identities rather than human sessions;
- client creation and revocation require `integration.manage`;
- generated bearer credentials are returned only at creation time;
- only a SHA-256 digest of the generated secret is stored;
- integration clients have explicit `ACTIVE` / `REVOKED` status;
- revocation requires a reason and appends audit evidence;
- the initial server-owned scope registry is intentionally limited to `qms.read`;
- unknown scopes are rejected;
- external bearer authentication uses a versioned `/api/v1/...` route;
- credential comparison uses constant-time comparison after digesting the supplied secret;
- successful authentication derives organization identity from the stored integration client, never from caller input;
- `lastUsedAt` is operational metadata and does not replace regulated audit evidence;
- first-administrator bootstrap receives `integration.manage`.

## Initial versioned endpoint

`GET /api/v1/integration/context`

The endpoint validates the bearer credential and required `qms.read` scope, then returns only integration context metadata (API version, integration client ID, organization ID and scopes). It intentionally exposes no document, personnel, quality-event, equipment, laboratory or reporting records.

## Credential format

`tqms.<integration-client-uuid>.<random-secret>`

The random secret is generated with 32 cryptographically secure random bytes and is not persisted in plaintext.

## Boundary

This slice does not yet add regulated external reads/writes, webhooks, event subscriptions, inbound LIMS commands, instrument interfaces, SSO, email/SMS provider integration, arbitrary scopes, shared-database access, or cross-tenant access. Those require separate reviewed slices after this authentication and tenancy boundary is validated.
