# Prompt 048 — Personnel Lifecycle Controls

## Slice 3 scope
This slice adds governed lifecycle operations to the Personnel foundation and workspace without introducing new permission keys or destructive personnel-history edits.

It adds:
- employee status transitions under `personnel.manage`;
- controlled status-change reason capture;
- required termination effective date;
- terminal behavior for `TERMINATED` employees;
- automatic closure of outstanding assignments whose assignment date is on or before the termination date;
- governed individual job-assignment ending with required end date and reason;
- append-only audit evidence for employee status changes and assignment ending;
- workspace actions available only to users with `personnel.manage`;
- service-level authorization and validation coverage.

## Integrity rules
- terminated employees cannot be reactivated or moved to another status;
- an employee cannot be transitioned to the status they already hold;
- termination date cannot precede hire date;
- assignment end date cannot precede assignment date;
- an assignment cannot be ended more than once;
- status and assignment operations remain tenant-bound and use the existing Personnel authorization boundary;
- no employee or assignment records are deleted.

## Deferred Prompt 048 slices
- employee credentials and expiration tracking;
- employee qualifications and evidence;
- controlled personnel-file attachments/export as needed;
- links into Training and Competency.
