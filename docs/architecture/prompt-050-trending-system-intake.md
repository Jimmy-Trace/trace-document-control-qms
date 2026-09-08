# Prompt 050 — Cross-event trending and system intake

## Scope
This final operational slice adds read-only cross-event analytics and an idempotent protected boundary for automated quality-event creation.

It adds:
- 1–24 month tenant-scoped quality-event analytics under `quality_event.read`;
- counts by status, type, severity, source, overdue state, and month;
- a 12-month rollup in the existing quality-event workspace;
- `QualityEventSystemTrigger` append-only idempotency evidence;
- a `CRON_SECRET`-protected internal system-intake endpoint;
- same-tenant ACTIVE reporter/owner validation for system events;
- deterministic source-system/source-key deduplication under a transaction advisory lock;
- SHA-256 payload binding and audit evidence for automated creation;
- user-facing event creation restricted to `MANUAL` source.

## Integrity boundaries
- automated intake cannot impersonate interactive creation as `SYSTEM`;
- duplicate source keys return the previously created event rather than creating another event;
- system-trigger evidence cannot be updated or deleted;
- analytics are read-only and never mutate lifecycle state;
- existing investigation, CAPA, effectiveness, escalation, closure, and electronic-signature controls remain unchanged.

## Migration
`0034_quality_event_system_intake`
