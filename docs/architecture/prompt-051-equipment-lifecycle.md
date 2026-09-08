# Prompt 051 — Equipment Lifecycle and Release Controls

## Scope
Add governed equipment status transitions and recurrence controls to the equipment foundation.

## Lifecycle
Allowed status transitions are:
- PLANNED -> ACTIVE or RETIRED;
- ACTIVE -> OUT_OF_SERVICE or RETIRED;
- OUT_OF_SERVICE -> ACTIVE or RETIRED;
- RETIRED is terminal.

Every transition requires a controlled reason, row-locks the equipment record, writes append-only `EquipmentStatusChange` evidence, and appends audit evidence.

## Qualification and release
Equipment may enter or re-enter ACTIVE status only when qualification evidence exists. Qualification events require a same-tenant AVAILABLE governed file.

If calibration or preventive maintenance is required, activation is blocked when its next due date is missing or overdue.

## Recurrence
- CALIBRATED events advance `nextCalibrationDueAt` from the event date by the configured calibration interval.
- MAINTENANCE events advance `nextMaintenanceDueAt` from the event date by the configured maintenance interval.
- Initial QUALIFIED evidence seeds missing calibration/maintenance due dates from the qualification date and configured interval.

## Integrity
OUT_OF_SERVICE, RETURNED_TO_SERVICE, and RETIRED equipment events cannot be posted directly. They are produced only by the governed lifecycle transition transaction so event history and equipment state cannot diverge.

## Boundary
Automated overdue hard stops, impact assessment/recall, notifications, operational workspace, analytics and automated quality-event triggers remain subsequent Prompt 051 slices.
