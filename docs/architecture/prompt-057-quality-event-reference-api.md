# Prompt 057 — Quality Event Status Reference API

## Purpose
Extend the governed external integration surface with bounded, tenant-scoped quality-event status metadata under the existing IntegrationClient authentication boundary.

## Endpoint
`GET /api/v1/qms/quality-events/status?limit=1..100`

## Controls
- bearer authentication uses the Prompt 057 IntegrationClient credential model;
- tenant identity is derived only from the authenticated integration client;
- `qms.read` is required;
- responses are limited to 1–100 records;
- successful reads append `IntegrationAccessEvent` evidence with resource `quality-event-status`;
- the external payload contains only event identifier/number, type, severity, source, lifecycle status, discovery time, and due date;
- free-text summary/description, user identities, investigation detail, root-cause analysis, CAPA actions, effectiveness checks, signatures, evidence files, and workflow comments are not exposed.

## Write boundary
This slice adds no external quality-event mutation, closure, ownership assignment, due-date change, CAPA action, signature, or workflow transition. Regulated writes remain internal controlled workflows.

## Deferred
Webhooks, subscriptions, inbound integration commands, broader quality-event detail, external writes, instrument interfaces, and SSO remain separate reviewed slices.
