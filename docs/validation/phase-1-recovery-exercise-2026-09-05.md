# Phase 1 recovery exercise evidence

Exercise date: 2026-09-05
Environment: Railway preview (synthetic data only)
Candidate SHA: `8dc50b53db6b497aadc81e784d23023e1eff9950`
Source database: `railway`
Isolated restoration target: `phase1_recovery_uat`

## Objectives

This exercise provides the documented isolated recovery evidence required for Phase 1 acceptance. The live Railway preview database was not overwritten or repointed during the exercise.

Repository planning defaults at the time of the exercise were RPO 24 hours and RTO 8 hours. These are planning defaults rather than contractual commitments.

## Procedure and evidence

1. Confirmed PostgreSQL recovery tools were unavailable in the application container and available in the Railway PostgreSQL service container.
2. Confirmed the Railway PostgreSQL server version was `18.6 (Debian 18.6-1.pgdg13+2)`.
3. Created isolated database `phase1_recovery_uat` alongside, but separate from, the live `railway` database.
4. Created a custom-format logical backup of `railway`:
   - artifact: `/tmp/phase1_recovery_uat.dump`
   - size: 130 KB
   - SHA-256: `48836c52f7c87d58ac79fe0ac6ab88cacebffd78285b4ced417e8832b0934d2e`
5. Restored the backup into `phase1_recovery_uat` using `pg_restore --no-owner --no-privileges`.
   - measured restore time: `0.726s` real (`0.036s` user, `0.017s` sys)
6. Compared key source and restored record counts. Source and restore matched exactly:
   - Organization: 1 / 1
   - User: 2 / 2
   - AuditEvent: 33 / 33
   - Document: 2 / 2
7. Ran the repository integrity suite against the restored database using the same command pattern used by CI:
   - `npx prisma db execute --file prisma/tests/integrity.sql --schema prisma/schema.prisma`
   - result: `Script executed successfully.`
8. Captured exact-candidate readiness from the running Railway application:
   - candidate SHA: `8dc50b53db6b497aadc81e784d23023e1eff9950`
   - readiness response: HTTP 200, status `ready`, database check `ok`
9. Performed read-only restored-data sampling:
   - Documents: `UAT-SOP-001 | UAT Phase 1 Controlled Document`; `UAT-SOP-002 | UAT Phase 1 Protected File Test`
   - DocumentVersion states: `EFFECTIVE | 0.1`; `DRAFT | 0.1`
   - WorkflowTask count: 3
   - ElectronicSignature count: 1
   - AcknowledgmentAssignment count: 0
   - AcknowledgmentCompletion count: 0
   - AuditEvent count: 33
   - NotificationOutbox count: 3
10. Removed the isolated recovery database and verified it no longer existed (`count = 0`).
11. Removed the temporary dump artifact and verified cleanup with `RECOVERY_DUMP_REMOVED`.

## Recovery outcome

| Decision | Result | Evidence |
| --- | --- | --- |
| Recovery integrity | Accepted | Exact source/restore counts, restored-data sampling, Prisma integrity suite passed |
| RPO | Achieved for this exercise | Backup was taken immediately before restore and reproduced the sampled live synthetic state |
| RTO | Achieved for this exercise | Restore itself completed in 0.726 seconds, far within the 8-hour planning objective |
| Candidate readiness | Accepted | Exact deployed candidate returned HTTP 200 readiness with database `ok` |
| Security / isolation | Accepted | Restore target was separate; live database was not overwritten or repointed; temporary recovery assets were removed |

## Deviation and corrective action

The repository recovery template and CI workflow still reference PostgreSQL 17, while the deployed Railway preview database server and service tools are PostgreSQL 18.6. The recovery exercise was therefore executed with PostgreSQL 18.6 so that it matched the actual deployed preview environment.

This is a documentation/tooling-version deviation, not a recovery-integrity failure. Corrective action: update the recovery documentation and release-validation configuration so the documented PostgreSQL version is explicitly aligned with the approved deployment baseline before production validation/release certification.

## Scope and limitations

- Synthetic preview data only; no PHI, PII, personnel records, or real laboratory documents were used.
- This engineering recovery exercise is not a regulatory validation or compliance certification.
- The exercise demonstrated logical backup/restore recoverability and integrity for the Railway preview. It does not replace encrypted production backups, production retention controls, or scheduled production recovery exercises.
