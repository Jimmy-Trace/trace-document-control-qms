# Prompt 047 — Record Disposition and Retention Integration

## Scope
This slice extends Record Management with governed archival while preserving regulated record identity and history.

Implemented:
- dedicated `record.archive` permission;
- ACTIVE -> ARCHIVED transition only, with no physical deletion;
- required controlled archive reason;
- QualityRecord support in retention disposition evaluation and legal holds;
- generic `QualityRecord` retention policies and optional record-type-specific policy keys using `QualityRecord:<RECORD_TYPE_CODE>`;
- longest applicable active retention policy controls eligibility;
- active legal holds block archival;
- archival and retention evidence are recorded in append-only audit history;
- Record Management UI exposes archive only to `record.archive` users;
- Retention & Holds administration can govern QualityRecord entities.

## Safety and integrity
Archival executes inside a database transaction. The QualityRecord row is locked before eligibility is checked, and the retention/legal-hold decision is evaluated before the status transition. Archived records are never deleted by this slice and cannot be archived again through the governed command.

The archive audit event records the controlled reason, prior/new status, record number/type, applicable retention-policy IDs, retention eligibility timestamp, and active-hold evidence used by the decision.

## Retention policy keys
- `QualityRecord` applies to all regulated quality records.
- `QualityRecord:<RECORD_TYPE_CODE>` applies to one governed RecordType code.
- when both are active, the longest retention period wins.

No regulatory retention duration is hard-coded by the application; administrators configure applicable policy metadata.
