# Prompt 056 — Reporting & Analytics Management Foundation

## Scope
This foundation introduces a governed, read-only reporting boundary across existing QMS data without exposing unrestricted SQL or direct production database querying.

The initial approved report sources are intentionally narrow:

- `QUALITY_EVENT_SUMMARY` — tenant-scoped quality-event counts by governed status;
- `EQUIPMENT_SUMMARY` — tenant-scoped equipment counts by governed status.

The second Prompt 056 slice adds source-specific governed filters and personal saved report views while preserving the finite server-owned reporting registry.

## Controls

- report definitions are tenant-scoped and use an enum-backed approved source key rather than SQL text;
- `report.read` is required to list/execute reports, inspect execution history, and manage the current user's personal saved views;
- `report.manage` is required to create governed report definitions;
- report execution derives organization identity from authenticated server context at the API boundary;
- only server-approved filter keys and values are accepted for each source;
- the current approved filter is `status`, validated independently against each source's real lifecycle values;
- unknown filter keys, arbitrary field names, SQL, table names, and unsupported status values are rejected;
- saved views are tenant-scoped, report-scoped, and owner-scoped and store only validated governed parameters;
- a user may list, replace, execute, or delete only that user's own saved views;
- each execution snapshots report code, name, source, validated parameters, result, row count, actor, and execution time;
- each result is bound to a SHA-256 digest;
- execution evidence is append-only at the database boundary;
- successful definition creation, saved-view changes, and report execution append audit evidence;
- System Administrator roles and controlled first-administrator bootstrap receive the reporting permissions.

## Integrity boundary

A report definition or saved view cannot contain SQL, a database object name, or arbitrary query text. Server code owns the finite source registry and parameter contract. Adding a new source or filter therefore requires a reviewed code/migration change rather than tenant-supplied query language.

This foundation does not create an enterprise warehouse, unrestricted query builder, cross-tenant analytics, finalized management reports, scheduling, dashboards, mutable finalized reports, or bulk export capability.
