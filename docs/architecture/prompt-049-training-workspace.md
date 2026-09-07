# Prompt 049 — Training Workspace and Lifecycle Controls

## Slice 2 scope
This slice makes the Training foundation operational while preserving regulated history.

It adds:
- a Training workspace visible only with `training.read`;
- separate `training.manage` controls for course creation, assignment, completion, cancellation, and reassignment;
- derived OVERDUE visibility for ASSIGNED items whose due date has passed;
- controlled cancellation with required reason, actor, and timestamp;
- governed reassignment implemented as cancellation of the prior assignment plus creation of a replacement in one transaction;
- append-only audit evidence for cancellation and reassignment;
- focused lifecycle validation tests.

## Integrity rules
- only ASSIGNED training can be cancelled, reassigned, or completed;
- cancellation never deletes or rewrites the prior assignment;
- reassignment preserves the prior assignment as CANCELLED and creates a new assignment;
- cancellation and reassignment require controlled reasons;
- TrainingRecord completion history remains immutable;
- overdue status is derived for display and does not silently mutate assignment state.

## Deferred Prompt 049 slices
- competency programs and competency elements;
- competency assessment evidence and qualification linkage;
- reminder/escalation automation beyond overdue visibility.
