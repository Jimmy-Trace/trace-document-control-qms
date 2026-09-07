# Prompt 047 — Record Management Foundation

## Scope
This slice begins the Record Management domain defined by the approved system and database architecture after completion of Document Control expansion.

Implemented foundation:
- tenant-scoped governed record types;
- immutable quality-record identity rows;
- optional binding to an AVAILABLE private FileObject;
- dedicated `record.read` and `record.create` permissions;
- System Administrator permission migration and first-administrator bootstrap coverage;
- authenticated list/create APIs;
- append-only audit evidence for record-type and quality-record creation;
- service-level least-privilege and validation tests.

## Regulated behavior and risk controls
QualityRecord creation is append-only in this slice. No ordinary update or delete path is introduced. Record type configuration requires `administration.manage`; record creation requires `record.create`; listing requires `record.read`. Tenant identity comes from authenticated server context at the API boundary and is rechecked by the authorization service.

When a file is attached, the store verifies that the file belongs to the same tenant and is in AVAILABLE state before the record is created. Composite foreign keys preserve tenant-safe relationships to record types, files, and creator users.

Every record type and quality record creation appends an AuditEvent. Historical record mutation, disposition, archival transitions, retention events, legal-hold integration, and record-management UI are deliberately deferred to later Prompt 047 slices so this foundation remains narrow and reviewable.

## Data model
Migration `0019_record_management_foundation` introduces:
- `RecordType`
- `QualityRecord`
- `QualityRecordStatus`
- `record.read`
- `record.create`

No existing regulated document, signature, acknowledgment, audit, retention, legal-hold, or controlled-copy data is rewritten.
