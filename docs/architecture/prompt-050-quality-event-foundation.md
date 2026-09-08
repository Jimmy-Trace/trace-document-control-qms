# Prompt 050 — Incident & Event Management Foundation

## Slice 1 scope
This slice establishes the governed quality-event foundation for the approved Incident & Event Management module.

It adds:
- tenant-scoped quality events with unique tenant-facing event numbers;
- event type, severity, source, status, summary, description, discovery time, reporter, optional owner, and optional due date;
- event types covering nonconformance, complaints, specimen/testing/QC/PT/equipment/reporting failures, safety/personnel events, deviations, and other events;
- concurrency-safe tenant event-number allocation;
- `quality_event.read` and `quality_event.manage` permissions;
- System Administrator and controlled first-admin bootstrap permission coverage;
- authenticated list/create APIs;
- transactional `QUALITY_EVENT_CREATED` audit evidence;
- focused authorization and validation tests.

## Integrity boundaries
- tenant isolation is enforced server-side through authorization and tenant-qualified persistence;
- owner assignment accepts only ACTIVE users in the same tenant;
- event history is not destructively editable in this slice;
- quality-event creation does not automatically release clinical, document, equipment, or other holds;
- no CAPA, investigation, root-cause, approval, electronic-signature, verification, or closure behavior is implied by event creation alone.

## Approved workflow direction
The broader domain remains configurable and will be implemented incrementally around the approved flow:

`Event -> Investigation -> Root Cause -> Risk Assessment -> Corrective Action -> Preventive Action -> Verification -> Closure`

## Deferred slices
- event workspace, ownership and status transitions;
- investigation evidence and affected-scope linkage;
- root-cause and risk assessment;
- CAPA plans/actions and dependencies;
- effectiveness verification;
- approvals/electronic signatures and controlled closure;
- escalations, notifications, dashboards, trending, and automated event triggers.

## Migration
`0028_quality_event_foundation`
