# Prompt 047 — Controlled Quality Record Export

## Scope
This slice adds exact-file export for regulated QualityRecord entries that are bound to an AVAILABLE governed FileObject.

Implemented:
- dedicated `record.export` permission;
- required controlled export reason;
- exact object-storage byte retrieval for the file bound to the selected QualityRecord;
- SHA-256 recomputation before release and hard failure on integrity mismatch;
- tenant-scoped record/type/file resolution;
- append-only `QUALITY_RECORD_EXPORTED` audit evidence;
- no-store response controls and integrity/record metadata response headers;
- Record Management UI export action only for users with `record.export` and records with a bound file;
- System Administrator and controlled bootstrap coverage for the new permission.

## Safety and integrity
The export does not mutate the QualityRecord, RecordType, FileObject, retention state, legal holds, or archival state. The exported bytes must exactly match the stored governed file SHA-256 before they are released.

The audit event records the export reason, record identity/status/type, file identity/name, and verified SHA-256. Cross-tenant record resolution returns access denied.

## Deliberate boundary
This slice exports the exact governed file bytes. Records without a governed file are not synthesized into a substitute artifact and cannot be exported through this endpoint. A future evidence-package feature may bundle record metadata, audit history, and file content as a separately governed deliverable.
