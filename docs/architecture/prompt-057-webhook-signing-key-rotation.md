# Prompt 057 — Webhook Signing Key Rotation

## Scope

This hardening slice closes the remaining signing-key lifecycle gap for governed webhook subscriptions.

## Rotation contract

- administrators with `integration.manage` may rotate the signing key for a REGISTERED subscription attached to an ACTIVE integration client;
- a non-empty rotation reason is required;
- rotation atomically increments `signingKeyVersion` on the subscription;
- the replacement secret is derived from the server-owned master secret and the new version;
- the replacement signing secret is returned once in the rotation response and is not stored in plaintext;
- the previous version is no longer selected for future delivery attempts after the transaction commits.

## Audit and security boundary

The same transaction records `INTEGRATION_WEBHOOK_SIGNING_KEY_ROTATED` with the new version and operator-provided reason. Audit metadata does not contain the signing secret, integration credential material, payload content, or payload hash.

No new integration scope, webhook event, endpoint destination capability, or external write authority is introduced. Existing HTTPS/SSRF validation, HMAC delivery signing, retry/dead-letter behavior, and tenant authorization remain unchanged.
