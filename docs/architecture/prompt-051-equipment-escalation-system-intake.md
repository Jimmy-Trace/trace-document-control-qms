# Prompt 051 — Equipment Escalation and System Recall Intake

## Scope
Complete the equipment-owned operational controls before the Prompt 051 completeness review and the Prompt 052 Reagents/Lots boundary.

## Controls
- active compliance holds and open recalls escalate at 1, 7, and 30 days;
- each crossed escalation level is append-only and recorded exactly once;
- active `equipment.manage` users receive deduplicated escalation notifications through the existing NotificationOutbox;
- escalation actions append audit evidence and do not impersonate a human actor;
- automated equipment recalls enter only through a `CRON_SECRET`-protected internal endpoint;
- system recall source keys are idempotent and bound to a SHA-256 payload hash;
- conflicting reuse of a source key is rejected;
- an automated trigger can link to an already-open human recall without creating a duplicate quarantine;
- system-origin recalls and trigger evidence are append-only and preserve the source system/key.

## Domain boundary
No reagent, lot, inventory, or material foreign key is added in Prompt 051 because those entities do not exist yet. Equipment-to-material linkage belongs in Prompt 052 after the Reagents/Lots bounded context establishes governed identities and lifecycle rules.
