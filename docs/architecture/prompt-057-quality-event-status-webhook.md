# Prompt 057 — Quality event status webhook

This slice activates the existing `quality_event.status` webhook event through the shared transactional integration outbox.

## Event source

The producer is the governed `QualityEventChange` lifecycle history. The application writes a `STATUS` change row in the same database transaction that updates the `QualityEvent` lifecycle state. An `AFTER INSERT` trigger records durable webhook intent only for `kind = 'STATUS'` rows.

The deterministic event ID is:

`quality_event.status:<qualityEventChangeId>`

This gives each lifecycle transition its own identity even though the same Quality Event may progress through several statuses.

## External payload

The payload contains only:

- quality event ID;
- status-change ID;
- prior status;
- new status;
- change timestamp.

The payload excludes the event summary and description, transition reason, actor and owner identities, investigation/root-cause content, CAPA records, effectiveness evidence, signatures, audit metadata, and files.

## Reliability and governance

The webhook intent is inserted in the same PostgreSQL transaction as the lifecycle-change row. The existing `(organizationId,eventId)` uniqueness rule makes intent idempotent. Reconciliation and outbound delivery continue to use the existing retry, HMAC-signing, destination-safety, timeout, and dead-letter controls.

This slice adds no new integration scope, permission, external write capability, public endpoint, or webhook event name.
