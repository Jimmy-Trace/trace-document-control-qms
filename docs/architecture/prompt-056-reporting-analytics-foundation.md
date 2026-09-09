# Prompt 056 — Reporting & Analytics Management Foundation

## Scope
This foundation introduces a governed, read-only reporting boundary across existing QMS data without exposing unrestricted SQL or direct production database querying.

The initial approved report sources are intentionally narrow:

- `QUALITY_EVENT_SUMMARY` — tenant-scoped quality-event counts by governed status;
- `EQUIPMENT_SUMMARY` — tenant-scoped equipment counts by governed status.

Later Prompt 056 slices may expand approved reporting views, filters, saved views, finalized reports, export formats, scheduling, and workspace UX after this foundation is green.

## Controls

- report definitions are tenant-scoped and use an enum-backed approved source key rather than SQL text;
- `report.read` is required to list/execute reports and inspect execution history;
- `report.manage` is required to create governed report definitions;
- report execution derives organization identity from authenticated server context at the API boundary;
- the foundation slice accepts no caller-defined query/filter parameters;
- each execution snapshots report code, name, source, parameters, result, row count, actor, and execution time;
- each result is bound to a SHA-256 digest;
- execution evidence is append-only at the database boundary;
- successful definition creation and report execution append audit evidence;
- System Administrator roles and controlled first-administrator bootstrap receive the new permissions.

## Integrity boundary

A report definition cannot contain SQL, a database object name, or arbitrary query text. Server code owns the finite source registry and parameter contract. Adding a new source therefore requires a reviewed code/migration change rather than tenant-supplied query language.

This foundation does not create an enterprise warehouse, unrestricted query builder, cross-tenant analytics, scheduled reports, mutable finalized reports, or bulk export capability.
