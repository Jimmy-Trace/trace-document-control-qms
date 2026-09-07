# Prompt 048 — Personnel Workspace

## Slice 2 scope
This slice makes the Personnel foundation operational in the application without changing the regulated data model.

It adds:
- a Personnel Management workspace mounted only for users with `personnel.read`;
- independent `personnel.manage` gating for employee, job-description, and assignment creation controls;
- employee search and governed personnel browsing;
- active job-assignment display by employee;
- creation forms that call the authenticated, authorized, audited Personnel APIs introduced in Slice 1;
- focused workspace-visibility tests preserving least privilege.

## Integrity boundary
- no direct browser-to-database write path is introduced;
- all mutations continue through the Personnel service and persistence layer from Slice 1;
- no employee update/delete, assignment end, status transition, credential, qualification, payroll, SSN, compensation, medical, or background-check functionality is introduced here;
- historical assignment records remain append-only in this slice.

## Deferred Prompt 048 slices
- governed employee status transitions and assignment ending;
- employee credentials and expiration tracking;
- employee qualifications and evidence;
- controlled personnel-file attachments/export as needed;
- links into Training and Competency.
