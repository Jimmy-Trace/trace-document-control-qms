# Release candidate 0.1.0-rc.4

## Purpose

`0.1.0-rc.4` is the first release-candidate baseline after completion of Prompt 058, the post-Prompt-058 release-readiness review, expanded validation traceability, and refreshed critical-workflow UAT coverage.

This document designates the candidate baseline only. It does **not** mean the candidate has been deployed, validated, accepted for production, regulator-certified, or approved for release.

## Candidate scope

The candidate includes the QMS implementation present on the immutable merge SHA that introduces this baseline, including the critical controls traced in:

- `docs/validation/traceability-matrix.md` (`UR-001` through `UR-013`);
- `docs/validation/traceability-matrix-expanded.md` (`UR-014` through `UR-025`);
- `docs/validation/critical-workflow-uat-protocol.md` (`UAT-01` through `UAT-15`);
- `docs/validation/critical-workflow-uat-post-prompt-058.md` (`UAT-16` through `UAT-39`).

## Version and artifact identity

- Candidate version: `0.1.0-rc.4`
- Authoritative package version: `package.json`
- Exact source identity: full Git commit SHA from `main`
- Application and migration containers: immutable digest-addressed OCI images built from that exact SHA
- Validation region: `us-west-1`
- Validation domain: `traceqms.com`
- Recovery class: Tier 1

The dependency set is unchanged by this version-designation change. The existing lockfile continues to control dependency resolution; no dependency refresh is authorized by this baseline PR.

## Required qualification before validation execution

Before an `rc.4` validation release is applied, retain evidence that the exact candidate SHA has:

1. successful CI and Security workflows;
2. successful Prisma schema validation and migration execution;
3. successful database integrity checks and backup/restore verification;
4. successful production container and private migration-container builds;
5. successful validation-environment qualification and AWS template/control checks;
6. an approved, reviewable AWS validation plan with immutable application and migration image digests.

## Required validation evidence

After protected deployment to the approved validation environment, complete and retain:

- migration task output and exit status;
- deployed release SHA/version and immutable image digests;
- liveness/readiness evidence;
- recovery exercise evidence and restore verification;
- all applicable `UAT-01` through `UAT-39` results against synthetic data;
- deviation, corrective-action, and retest evidence for any failed or conditional result;
- residual-risk decisions where applicable;
- security review for governed AI controls;
- final Quality, Security, and Service Owner release decisions.

Executed evidence that contains identities, environment details, screenshots, operational records, or sensitive configuration belongs in the controlled validation record rather than source control.

## Release rule

Do not represent `0.1.0-rc.4` as validated, production-ready, compliant, certified, or approved for release merely because this baseline merges or because CI/Security passes. Those conclusions require completion and approval of the controlled validation package for the exact immutable candidate SHA.
