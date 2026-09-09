# Prompt 057 — Equipment status webhook event

## Scope
This slice activates the already-approved `equipment.status` webhook event using the transactional integration outbox established in Prompt 057.

## Source of truth
The event is produced from `EquipmentStatusChange`, the append-only governed status-transition ledger. Every insert receives a unique status-change ID, so transitions such as `ACTIVE -> OUT_OF_SERVICE -> ACTIVE` remain independently identifiable.

## Event contract
Event name: `equipment.status`

Deterministic event ID: `equipment.status:<equipmentStatusChangeId>`

Payload fields:
- `equipmentId`
- `statusChangeId`
- `fromStatus`
- `toStatus`
- `changedAt`

The payload intentionally excludes transition reason, actor identity, equipment narrative, service records, qualification/calibration evidence, audit metadata, and files.

## Reliability
The outbox row is inserted by an `AFTER INSERT` trigger on `EquipmentStatusChange`, so durable webhook intent is committed in the same database transaction as the governed status-change record. The existing outbox reconciler provides retry-safe delivery-row creation and the existing delivery worker retains HMAC signing, destination safety validation, bounded timeout/payload behavior, retries, and dead-letter handling.

## Security boundary
- No new integration scope or permission.
- No external write capability.
- No new public endpoint.
- No new webhook event name; `equipment.status` was already on the server-owned allow-list.
- No user identity or status-change reason is exported.
