# Prompt 056 — Finalized Reports and Governed CSV Export

## Scope
This slice makes a completed governed report execution eligible for controlled finalization and CSV export without re-running the report or exposing a new query surface.

## Controls
- only an existing same-tenant `ReportExecution` can be finalized;
- finalization requires `report.manage`;
- each execution can be finalized once;
- the finalized record snapshots report identity, source, parameters, result, row count, SHA-256 result digest, finalizing user, and time;
- finalized records are append-only at the database boundary;
- finalization verifies the stored execution result against its recorded SHA-256 digest before copying it;
- CSV export requires the dedicated `report.export` permission;
- export is generated only from the stored finalized result snapshot and does not query source tables again;
- CSV export verifies the finalized result digest before rendering;
- successful finalization and export append audit evidence;
- the API derives organization scope from the authenticated context;
- the controlled first-administrator bootstrap includes `report.export`.

## Boundary
This slice does not add PDF/Excel export, bulk cross-tenant export, scheduling, email delivery, dashboards, mutable finalized reports, arbitrary field selection, arbitrary SQL, or production-database query access.
