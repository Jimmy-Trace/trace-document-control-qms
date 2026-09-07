# Prompt 048 — Personnel Qualifications and Evidence

## Slice 5 scope
This slice adds governed employee qualification tracking to the Personnel domain without introducing Training or Competency workflows yet.

It adds:
- append-only `EmployeeQualification` records scoped to tenant and employee;
- qualification type and optional governed scope text;
- required qualification date and optional expiration date;
- optional same-tenant AVAILABLE file evidence binding;
- qualification browsing for `personnel.read` users;
- qualification creation under `personnel.manage`;
- CURRENT/EXPIRED workspace visibility derived from expiration date;
- append-only audit evidence for qualification creation;
- focused authorization and validation tests.

## Integrity rules
- qualifications cannot be added to terminated employees;
- expiration cannot precede the qualification date;
- evidence files must belong to the same tenant and be AVAILABLE;
- qualifications are not edited or deleted in this slice;
- requalification is represented by a new qualification record so prior qualification evidence remains historical;
- no payroll, SSN, compensation, medical, or background-check data is introduced.

## Deferred boundary
Training assignment, competency assessment, qualification restrictions, and automatic qualification state changes remain in the subsequent Training and Competency domain so Personnel does not duplicate that workflow engine.
