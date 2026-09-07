# Prompt 049 — Training & Competency Foundation

## Slice 1 scope
This slice establishes the Training portion of the approved Training & Competency domain.

It adds:
- tenant-scoped `TrainingCourse`, `TrainingAssignment`, and immutable `TrainingRecord` entities;
- dedicated `training.read` and `training.manage` permissions;
- governed course creation and employee training assignment;
- required assignment date and optional due date;
- controlled completion recording with optional same-tenant AVAILABLE file evidence;
- append-only audit evidence for course creation, assignment, and completion;
- focused authorization and date-validation tests.

## Integrity rules
- training cannot be assigned to terminated employees;
- inactive courses cannot be assigned;
- due dates cannot precede assignment dates;
- only ASSIGNED training can be completed;
- one completion record is permitted per assignment;
- completion evidence files must belong to the same tenant and be AVAILABLE;
- completion records are not edited or deleted in this slice.

## Deferred Prompt 049 slices
- Training workspace and assignment/completion operational UI;
- cancellation/reassignment and overdue controls;
- competency programs and elements;
- competency assessments, evidence, and qualification linkage.
