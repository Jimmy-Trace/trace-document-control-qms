# Prompt 057 — Integration client credential rotation

This hardening slice extends the existing administrator-only integration-client management boundary without widening external integration permissions.

## Administrative listing

Integration client listing remains protected by `integration.manage` and returns lifecycle metadata only. Stored credential hashes are not selected or returned.

## Credential rotation

Credential rotation is available only for an ACTIVE integration client in the authenticated administrator's organization. A non-empty rotation reason is required.

The service locks the client row, generates a fresh 256-bit random secret, replaces the stored SHA-256 secret hash, resets `lastUsedAt`, and writes `INTEGRATION_CLIENT_CREDENTIAL_ROTATED` audit evidence in the same database transaction. Replacing the hash immediately invalidates the previous bearer credential when the transaction commits.

The new `tqms.<integrationClientId>.<secret>` bearer credential is returned only in the rotation response. Plaintext credential material is not stored in the database or audit metadata.

## Governance boundary

This slice adds no integration scope, no external write permission, no public QMS mutation API, and no credential recovery endpoint. Existing client revocation and `qms.read` scope enforcement remain unchanged.
