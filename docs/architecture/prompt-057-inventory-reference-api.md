# Prompt 057 — Inventory Lot Status Reference API

## Purpose
Extend the governed external integration boundary with read-only material/lot reference data for approved downstream systems.

## Endpoint
`GET /api/v1/qms/inventory/lots/status`

## Controls
- requires IntegrationClient bearer authentication;
- requires the existing `qms.read` integration scope;
- derives tenant identity only from the authenticated integration client;
- accepts only the shared bounded `limit` query parameter (1–100, default 50);
- returns governed material identity plus material-lot lifecycle/status metadata;
- uses the repository's existing lot statuses without inventing a separate release state;
- successful reads append to `IntegrationAccessEvent` with resource `material-lot-status`.

## Exposed fields
- material identity: id, material number, name, manufacturer, catalog number, material status;
- lot identity: id and lot number;
- lot status: RECEIVED, ACCEPTED, QUARANTINED, REJECTED, EXPIRED, RECALLED, or DEPLETED;
- received/expiration dates;
- quantity received and unit of measure;
- site and department identifiers.

## Explicit non-goals
This slice does not expose inventory transaction history, transfer history, user identities, evidence files, audit narratives, unrestricted balances, or external mutation endpoints. It does not add a new integration scope, caller-supplied tenant identifier, direct database access, inbound LIMS commands, webhooks, or instrument interfaces.
