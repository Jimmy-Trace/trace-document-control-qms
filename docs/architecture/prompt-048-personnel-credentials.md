# Prompt 048 — Personnel Credentials and Expiration Tracking

## Slice 4 scope
This slice adds governed employee credential tracking to the Personnel domain.

It adds:
- append-only `EmployeeCredential` records scoped to tenant and employee;
- credential type, optional credential number and issuing authority;
- issue and expiration dates with database and service validation;
- optional same-tenant AVAILABLE file evidence binding;
- credential browsing for `personnel.read` users;
- credential creation under `personnel.manage`;
- CURRENT/EXPIRED workspace visibility derived from expiration date;
- append-only audit evidence for credential creation;
- focused authorization and validation tests.

## Integrity rules
- credentials cannot be added to terminated employees;
- expiration cannot precede issue date;
- evidence files must belong to the same tenant and be AVAILABLE;
- credentials are not edited or deleted in this slice;
- renewal is represented by a new credential record so the prior credential remains historical evidence;
- no payroll, SSN, compensation, medical, or background-check data is introduced.

## Deferred Prompt 048 slices
- employee qualifications and qualification evidence;
- controlled credential evidence export if required beyond existing file controls;
- links into Training and Competency.
