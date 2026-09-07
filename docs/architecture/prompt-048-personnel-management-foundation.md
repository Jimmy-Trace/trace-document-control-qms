# Prompt 048 — Personnel Management Foundation

## Architecture basis
The approved system architecture places Personnel immediately after Record Management. The database architecture identifies employees, employee credentials, employee qualifications, job descriptions, and employee job assignments as the Personnel domain.

## Slice 1 scope
This slice establishes the governed employment-identity and job-assignment foundation:
- `Employee` as a tenant-scoped regulated employment record, separate from authentication identity;
- optional same-tenant link from Employee to an existing User account;
- unique tenant-scoped employee number;
- governed `JobDescription` configuration;
- append-only `EmployeeJobAssignment` history with optional site/department scope;
- at most one active primary assignment per employee;
- `personnel.read` and `personnel.manage` permissions;
- System Administrator and controlled bootstrap coverage;
- authenticated APIs for employee, job-description, and assignment list/create operations;
- append-only audit evidence for employee creation, job-description creation, and job assignment.

## Data integrity
- employee, user, job description, site, department, and assignment relationships are tenant-bound;
- employee numbers and job-description codes are unique inside a tenant;
- termination date cannot precede hire date;
- assignment end date cannot precede assignment date;
- inactive employees and inactive job descriptions cannot receive new assignments;
- a department must be valid for the tenant and cannot conflict with an explicitly selected site;
- historical assignments are not overwritten by this slice.

## Privacy boundary
The foundation intentionally stores only minimum employment metadata needed for QMS linkage. It does not add Social Security numbers, payroll, compensation, medical information, background-check data, or other high-sensitivity HR fields.

## Deferred Prompt 048 slices
- personnel workspace and governed status/assignment transitions;
- employee credentials and expiration tracking;
- employee qualifications and evidence;
- controlled personnel-file attachments/export as needed;
- links from Personnel into the later Training and Competency domains.
