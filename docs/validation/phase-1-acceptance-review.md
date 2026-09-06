# Phase 1 foundation acceptance review

## Closure review — 2026-09-05

Reviewed source: `main` after PR #43 merge (`d26939de2000088b87f46b31b981c0000ce90690`)  
Decision: **Accepted — Phase 1 engineering foundation closed**

This closure review supersedes the open-blocker status of the original 2026-08-27 review while preserving that review below as historical evidence. It is an engineering acceptance decision for the synthetic Railway preview foundation. It is **not** regulatory validation, compliance certification, production authorization, or approval to process PHI/PII or real laboratory records.

### Closure results

| Foundation capability | Closure result | Closure evidence / disposition |
| --- | --- | --- |
| Database and migrations | Pass | Migration-only database changes remained green in CI; deployed database integrity and isolated logical recovery were exercised successfully. |
| Tenant isolation foundation | Pass | Deployed cross-tenant administration attempt was rejected with HTTP 403; temporary synthetic second-tenant fixture was removed and single-tenant state re-verified. |
| Audit logging foundation | Pass | Database-level UPDATE and DELETE attempts against `AuditEvent` were rejected by the append-only trigger. Authorized audit-history viewer was deployed, exercised with filters and pagination, and direct access by a user without `audit.read` returned HTTP 403. |
| Dashboard/application shell | Pass for Phase 1 preview | Authenticated entry, administration, document workspace, readiness, and deployed browser UAT completed successfully in the synthetic preview. |
| Authentication | Pass | Administrator and limited-user login paths, credential reset recovery, authentication-event evidence, generic failure messaging, five-failure throttling threshold, throttled sixth attempt, logout endpoint, session revocation, and protected-resource rejection after logout were exercised. |
| Organizations and departments | Pass | Authorized site and department administration completed in deployed UAT with audit evidence; cross-tenant site use was rejected. |
| Roles and permissions | Pass | Synthetic read-only role and assignment were created and exercised. Limited user lacked administrator delivery diagnostics and direct audit API access, confirming server-side permission boundaries. |
| File storage | Pass | Private upload state transition, clean scan availability, malicious quarantine, download, controlled document-version binding, SHA-256 evidence, retention-safe logical archive, and prohibition on removal of a controlled bound file were exercised. |
| Preview operations and security boundary | Pass | Railway preview remained synthetic-data-only; CI/Security checks passed on closure PRs; readiness returned HTTP 200 with database `ok`. |
| Recovery exercise | Pass with documented deviation | Isolated logical restore completed into `phase1_recovery_uat`; source/restore sampled counts matched; `prisma/tests/integrity.sql` executed successfully; restore duration was 0.726 s; recovery DB and dump were removed. PostgreSQL 18.6 was used because the deployed Railway environment had moved from the template's hard-coded PostgreSQL 17 baseline. PR #43 updated the template to require alignment with the approved deployed PostgreSQL version. |

### Phase 1 closure decision

No acceptance blocker from the original Phase 1 foundation review remains open for the synthetic Railway preview scope. Phase 1 is therefore **closed as an accepted engineering foundation**.

The following controls remain mandatory after closure:

- keep the Railway preview synthetic-data-only until a separately approved validation/production release process authorizes otherwise;
- continue migration-only schema changes, CI/Security gating, backup/restore exercises, and immutable-history controls;
- do not represent this engineering acceptance as CAP, CLIA, HIPAA, ISO 15189, SOC 2, or 21 CFR Part 11 certification or compliance;
- retain Phase 1 UAT/recovery evidence and subsequent corrective actions under controlled document/change management;
- treat future production hosting, validated-state release, application-user MFA, formal business continuity objectives, and regulatory qualification as separate release/validation work unless explicitly approved in a later phase.

---

## Original acceptance review — 2026-08-27

Reviewed source: `origin/main` at `5b0f33c`  
Decision: **Conditional — remediation required before Phase 1 closure**

## Scope

This review compares the implemented repository against the original Phase 1
foundation commitments: authentication, organizations, departments, roles,
permissions, database, audit logging, dashboard, and file storage. It is an
engineering acceptance review, not regulatory validation or a compliance
certification.

## Acceptance results

| Foundation capability | Result | Evidence | Remaining work |
| --- | --- | --- | --- |
| Database and migrations | Pass | Prisma schema; migrations `0001`–`0010`; Railway migration image; successful Railway migration deployment | Continue migration-only schema changes and backup/restore exercises |
| Tenant isolation foundation | Pass with follow-up | Composite organization keys, session-derived tenant context, authorization and integrity tests | Exercise cross-tenant rejection in deployed UAT |
| Audit logging foundation | Pass with follow-up | Append-only database triggers and audit events in consequential document workflows | Add an authorized audit-history viewer and deployed integrity evidence |
| Dashboard/application shell | Pass for preview | Authenticated document workspace, health/readiness endpoints, synthetic-data boundary | Complete authenticated entry flow and deployed UAT |
| Authentication | Blocked | Password hashing, credential/session/authentication-event models, cookie validation, idle and absolute expiry tests | Add login, logout, session issuance/revocation, rate limiting/lockout, bootstrap administration, and browser UAT |
| Organizations and departments | Blocked | Organization, site, and department schema with tenant constraints | Add authorized administration services and UI with audit events |
| Roles and permissions | Conditional | RBAC schema, permission evaluation, and server-side enforcement on document APIs | Add role/user administration and verify intended site/department scope behavior end to end |
| File storage | Blocked | `FileObject` metadata model, hashes, document-version relationship, and S3-compatible architecture | Implement private object storage, authorized upload/download, content-hash verification, audit events, and retention-safe deletion controls |
| Preview operations and security boundary | Pass | Railway runbook, dedicated migration image, readiness endpoint, preview warning, cost controls, MFA | Keep the environment synthetic-data-only and outside validation evidence |

## Important sequencing finding

The repository already contains substantial Electronic Document Control work,
including lifecycle, review, approval, electronic-signature, acknowledgment,
notification, and workflow-administration capabilities. This work is retained.
It does not eliminate the Phase 1 blockers above, because users still need a
complete authenticated entry path, controlled administration, and real private
file storage before the foundation can be accepted.

## Remediation sequence

1. **Prompt 033 — Authentication entry and session lifecycle**
   Implement login/logout, session issuance and revocation, authentication-event
   evidence, throttling/lockout behavior, secure cookies, and a controlled
   first-administrator bootstrap procedure.
2. **Prompt 034 — Tenant and access administration**
   Implement authorized organization/site/department, user, role, and permission
   administration with audit events and segregation-of-duties safeguards.
3. **Prompt 035 — Private controlled-file storage**
   Implement an S3-compatible provider boundary, authorized upload/download,
   metadata and SHA-256 binding, malware-scanning state boundary, audit events,
   and retention/legal-hold-safe removal behavior. The Railway preview must use
   synthetic files only.
4. **Prompt 036 — Phase 1 acceptance evidence**
   Run clean CI/security checks, database integrity checks, deployed synthetic
   UAT, tenant-isolation tests, authentication tests, file-integrity tests, and a
   documented recovery exercise. Close Phase 1 only if no acceptance blocker
   remains.

## Controls during remediation

- Do not enter PHI, PII, personnel records, or real laboratory documents in the
  Railway preview.
- Do not weaken server-side authorization or immutable-history controls.
- Do not treat Railway account MFA as application-user MFA.
- Do not represent successful testing as CAP, CLIA, HIPAA, ISO 15189, or
  21 CFR Part 11 compliance.
- Publish each prompt through its own reviewed pull request and require CI and
  Security to pass before merge.
