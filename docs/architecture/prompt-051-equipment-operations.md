# Prompt 051 — Equipment Operational Workspace

## Scope
Make the governed equipment controls operationally visible and usable after the foundation, lifecycle, and compliance/impact slices.

## Controls
- equipment workspace visibility is gated by `equipment.read`;
- service/repair evidence requires `equipment.manage` and is append-only;
- retired equipment cannot receive new service records;
- optional evidence files must be AVAILABLE and same-tenant;
- equipment usability is derived from administrative status, active compliance holds, and required calibration/maintenance due dates;
- new overdue compliance holds notify active users who hold `equipment.manage` through the existing deduplicated NotificationOutbox;
- management analytics report active/out-of-service/retired counts, active holds, 30-day calibration/maintenance due counts, and 90-day failed service records.

## Integrity
The workspace does not directly mutate regulated status or compliance evidence. All writes go through authenticated server-side service boundaries and audited persistence.

## Boundary
Recall/quarantine, broader automated escalation, inventory linkage, and final Prompt 051 completeness review remain subsequent work.
