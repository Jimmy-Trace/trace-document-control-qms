# Administration page containment

## Scope

This UI increment completes the Administration information-architecture cleanup without changing authorization, API contracts, audit semantics, database schema, document lifecycle logic, or regulated-record behavior.

## Behavior

- The global QMS operational module shell is visible only in the Documents experience.
- Administration and Review Queue no longer continue into unrelated operational modules.
- Review Workflow Templates is available as an Administration subsection.
- Notification Delivery Monitoring is available as an Administration subsection.
- Legacy stacked workflow-template and notification panels are suppressed in Administration to avoid duplicate controls.
- Existing server-side permission checks remain authoritative for workflow-template, notification, and membership operations.

## Visual acceptance

Railway visual review should confirm that selecting Administration presents one focused Administration workspace at a time and ends cleanly without the QMS Modules shell beneath it.
