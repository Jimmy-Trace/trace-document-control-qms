# Post-Prompt-058 critical workflow UAT protocol

## Purpose

This protocol extends `critical-workflow-uat-protocol.md` for the later critical controls mapped in `traceability-matrix-expanded.md` (`UR-014` through `UR-025`). Execute only against an immutable release-candidate SHA in the approved validation environment using synthetic data.

For every case record the deployed SHA, package version, tester identity/role, timestamps, test inputs, expected result, actual result, evidence reference, and pass/fail decision. Negative cases must demonstrate fail-closed behavior without unauthorized mutation or data disclosure.

## Preconditions

- Existing `UAT-01` through `UAT-15` remain applicable and are executed separately.
- Exact candidate SHA/package version are recorded before execution.
- CI, Security, migrations, readiness, and validation-environment qualification have passed for the same candidate.
- Required test users/roles, sites/departments, synthetic records, personnel, training items, quality events, equipment, inventory lots, laboratory methods/projects, reporting views, integration clients, webhook endpoints, and AI tenant-policy test data exist as applicable.
- No production PHI/PII, credentials, tokens, secrets, or unrelated tenant data may appear in screenshots or evidence attachments.

## Test cases

| ID | Requirement | Actor | Procedure | Expected result |
| --- | --- | --- | --- | --- |
| UAT-16 | UR-014 | Records manager | Create a controlled record, verify attribution/retention metadata, export it, then initiate governed disposition | Record remains tenant-scoped and attributable; export is controlled; disposition follows configured governance and leaves immutable history |
| UAT-17 | UR-014 | Unauthorized user | Attempt record access/export/disposition using a known record identifier | Generic denial or not-found behavior; no record content, export, disposition, or cross-tenant data is returned or changed |
| UAT-18 | UR-015 | Personnel administrator | Create/update a personnel profile, add qualification and credential evidence, then perform a permitted lifecycle-status change | Qualification/credential/status evidence is tenant-scoped, attributable, auditable, and visible only to authorized users |
| UAT-19 | UR-015 | Unauthorized user | Attempt personnel lifecycle or credential mutation | Mutation is rejected and existing personnel evidence remains unchanged |
| UAT-20 | UR-016 | Training administrator / assignee | Assign required training and competency activity, complete it as the assignee, and review completion evidence | Assignment, completion, competency result, actor, timestamps, and evidence remain attributable and tenant-scoped |
| UAT-21 | UR-016 | Wrong assignee | Attempt to complete another user's assigned training/competency task | Completion is denied and no evidence is recorded for the unauthorized actor |
| UAT-22 | UR-017 | Quality user / approver | Create a quality event, document investigation/root cause/risk, create CAPA, complete effectiveness review, and perform controlled closure | Lifecycle gates enforce required evidence; closure occurs only after required steps/approvals; audit chronology is complete |
| UAT-23 | UR-017 | Quality user | Attempt closure with required investigation/CAPA/effectiveness evidence incomplete | Closure is blocked with no silent state transition or loss of existing evidence |
| UAT-24 | UR-018 | Equipment manager | Register equipment, record qualification/PM/calibration status, place it out of service/quarantine, and document impact assessment | Equipment lifecycle and hard stops are enforced; status, due controls, impact, and audit evidence remain attributable |
| UAT-25 | UR-018 | Operator | Attempt governed use/transition of equipment that is expired, out of service, or quarantined | Operation is blocked where configured as a hard stop; no unauthorized lifecycle change occurs |
| UAT-26 | UR-019 | Inventory user | Receive a material lot, perform acceptance, barcode/stock transaction, reservation/transfer, and controlled recall/disposition | Lot identity, quantity movement, locations, acceptance, reservation/transfer, recall and disposition remain traceable |
| UAT-27 | UR-019 | Inventory user | Attempt use/reservation/transfer of expired, rejected, quarantined, or recalled material | Governed action is blocked and existing lot/transaction history remains intact |
| UAT-28 | UR-020 | Laboratory validation user | Create/configure a validation project, define criteria, record results, and complete only after all completion criteria pass | Project lifecycle gates require complete criteria/results and prevent completion when required evidence is missing or failed |
| UAT-29 | UR-020 | Unauthorized or invalid-state user | Attempt result entry or lifecycle transition in an invalid state or without required permission | Operation is denied without unauthorized result or lifecycle mutation |
| UAT-30 | UR-021 | Reporting user | Generate an approved report and finalized CSV export from governed reporting views | Output contains only approved fields/data, is attributable, and does not expose unrestricted mutable database access |
| UAT-31 | UR-021 | Reporting user | Attempt to access a non-approved field/query path or modify source data through reporting | Request is rejected; no source record is altered |
| UAT-32 | UR-022 | Integration administrator | Create/activate an authorized integration client and webhook subscription, emit an approved event, and verify signed delivery/outbox evidence | Access is tenant-bound/read-only; webhook event uses approved allow-list, durable outbox, HMAC signature, deterministic event identity, and auditable delivery state |
| UAT-33 | UR-022/UR-025 | Integration administrator | Exercise endpoint rejection, retry/dead-letter, requeue, and secret rotation against synthetic events | Unsafe endpoint is rejected; retry/dead-letter behavior is bounded; requeue is controlled; rotated secret is honored without reviving revoked clients/subscriptions |
| UAT-34 | UR-025 | Auditor | Compare equipment, inventory, quality-event, validation-project, and document status webhook payloads | Payloads contain approved metadata only, preserve deterministic identity, and omit prohibited record bodies/evidence content |
| UAT-35 | UR-023 | Tenant AI administrator / user | Enable synthetic tenant AI policy, approved provider/model, allowed classification, and active credential binding; request an approved assistive use case | Request succeeds only through the governed tenant-bound path; evidence shows request and terminal outcome without exposing credential values |
| UAT-36 | UR-023 | AI user | Repeat AI request with policy disabled, disallowed model/provider, prohibited source classification, or missing/inactive credential binding | Request fails closed before provider execution and leaves auditable failure evidence as applicable |
| UAT-37 | UR-023 | AI administrator | Review AI diagnostics and execution evidence | Diagnostics show policy/provider/binding metadata and bounded event history without prompt/output bodies or secret values |
| UAT-38 | UR-024 | AI user / approver | Attempt to use AI assistance to perform approval, signature, lifecycle transition, compliance decision, workflow bypass, or regulated-record mutation | No such authority is available through the AI endpoint or adapter path; regulated action remains available only through its existing governed workflow |
| UAT-39 | UR-023/UR-024 | Security tester | Cause provider timeout/error/invalid response after a governed request is created | Execution terminates fail-closed; `FAILED` terminal evidence is recorded or a traceability error is raised if terminal evidence cannot be written; credential/prompt/output bodies are not logged |

## Evidence mapping

The controlled execution record should map each case to its corresponding `UR-014` through `UR-025` requirement, exact candidate SHA, relevant automated-test run, and any migration/integrity evidence. For webhook/AI cases, retain only metadata needed to prove the control; do not attach credentials, secret values, raw access tokens, or prohibited content.

## Acceptance

All applicable critical cases pass. Any failure or conditional acceptance requires a deviation record with impact assessment, corrective action, retest evidence, residual-risk owner, and quality approval before release-candidate approval.

Passing this protocol is validation evidence for a specific candidate only. It does not independently establish regulatory certification, production approval, or general compliance.
