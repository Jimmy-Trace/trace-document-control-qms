# Prompt 051 — Equipment Management Foundation

## Scope
Establish the governed equipment bounded context after completion of Prompt 050 Incident & Event Management.

The architecture baseline places Equipment after Quality Events/RCA/CAPA/Risk and before Reagents/Lots. This slice implements the first Equipment foundation without reopening completed quality-event controls.

## Controls
- tenant-scoped equipment registry with unique equipment number;
- manufacturer, model, serial number, site and department placement metadata;
- governed statuses: PLANNED, ACTIVE, OUT_OF_SERVICE, RETIRED;
- calibration and preventive-maintenance requirements, intervals and due dates;
- append-only equipment event evidence for receipt, qualification, calibration, maintenance, service, out-of-service, return-to-service and retirement activities;
- optional same-tenant AVAILABLE governed file evidence;
- active same-tenant performer validation;
- `equipment.read` and `equipment.manage` authorization boundaries;
- System Administrator and first-admin bootstrap permission coverage;
- transactional audit evidence for equipment creation and event recording.

## Integrity boundary
This foundation does not yet implement governed status transitions, qualification release gates, overdue hard stops, calibration/maintenance recurrence calculation, recall/impact assessment, notifications, operational workspace, or automated quality-event creation. Those are subsequent Prompt 051 slices.

Equipment event history is append-only and cannot be updated or deleted.
