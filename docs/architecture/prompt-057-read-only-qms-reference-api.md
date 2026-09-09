# Prompt 057 — Read-only QMS Reference API

## Scope

This slice extends the Prompt 057 integration-client foundation with the first authenticated external QMS reference endpoint.

The initial resource is deliberately narrow: current EFFECTIVE controlled-document metadata only.

## Controls

- external authentication reuses the governed integration bearer credential boundary;
- `qms.read` is required;
- organization identity comes only from the authenticated IntegrationClient record;
- callers cannot supply or override tenant identity;
- only ACTIVE documents whose current version is EFFECTIVE are returned;
- content text, file bytes, user data, workflow comments, signatures, and other internal regulated details are not exposed;
- output is bounded to at most 100 records per request;
- each successful read appends IntegrationAccessEvent evidence inside the same database transaction as the read;
- IntegrationAccessEvent records are append-only at the database boundary;
- no external write, lifecycle transition, approval, signature, or workflow-bypass capability is added.

## Endpoint

`GET /api/v1/qms/documents/effective`

Optional query parameter: `limit` from 1 through 100.

Returned metadata includes document/version identifiers, document number, title, document type code/name, revision label, effective date, and the exact controlled-version content hash.

## Boundary

This slice does not expose draft/review content, historical versions, file downloads, acknowledgments, quality events, equipment, laboratory records, inbound LIMS commands, webhooks, subscriptions, or external write APIs. Those require separate reviewed Prompt 057 slices.
