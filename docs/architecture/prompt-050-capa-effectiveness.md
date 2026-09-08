# Prompt 050 — CAPA Actions and Effectiveness Verification

## Slice 4 scope
This slice adds governed corrective and preventive actions linked to quality events after investigation/root-cause/risk assessment.

It adds:
- corrective and preventive action records;
- active same-tenant action ownership and due dates;
- one-way action completion with required completion evidence;
- append-only effectiveness checks with PASS/FAIL result and required evidence;
- authenticated CAPA list/create/complete/verify APIs under existing quality-event permissions;
- transactional audit evidence for CAPA creation, completion, and effectiveness checks.

## Workflow boundaries
- CAPA actions may be created only when the quality event is `ACTION_REQUIRED` or `VERIFICATION`.
- CAPA completion does not change event status automatically.
- effectiveness checks may be recorded only after the CAPA action is completed.
- PASS/FAIL effectiveness results remain evidence and do not silently close, reopen, or otherwise mutate the quality event.

## Integrity boundaries
- CAPA and effectiveness evidence are tenant-bound and event-bound;
- CAPA completion is one-way;
- effectiveness history is append-only;
- owners must be ACTIVE users from the same tenant;
- final event closure remains unavailable outside the later controlled closure/e-signature workflow.

## Migration
`0031_quality_event_capa_effectiveness`
