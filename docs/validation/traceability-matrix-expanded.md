# Document Control QMS expanded validation traceability matrix

## Purpose

This matrix extends the existing critical-control traceability baseline beyond `UR-013` for later implemented modules. It links implemented user requirements to design controls and repeatable automated evidence. “Automated pass required” means the cited tests must pass in CI; it is not a claim of regulatory certification, validation approval, or production readiness.

## Existing baseline

`UR-001` through `UR-013` remain governed by `docs/validation/traceability-matrix.md` and are not duplicated here.

| ID | User requirement | Functional/design control | Automated evidence | RC status |
| --- | --- | --- | --- | --- |
| UR-014 | Controlled records remain attributable, retained, exportable, and subject to governed disposition | Tenant-scoped record registry, retention/disposition state, immutable history, controlled export boundary | record-management, record-export, record-disposition, database-integrity tests | Automated pass required plus UAT |
| UR-015 | Personnel qualifications, credentials, status, and lifecycle changes remain tenant-scoped and auditable | Personnel profile boundary, qualification/credential records, controlled status transitions, RBAC and audit evidence | personnel-management, personnel-qualification, personnel-credential, personnel-lifecycle tests | Automated pass required plus UAT |
| UR-016 | Training and competency activities remain assigned, attributable, and evidence-backed | Controlled training assignments, completion evidence, competency workflow, tenant/actor authorization | training and competency service/workspace tests | Automated pass required plus UAT |
| UR-017 | Quality events and CAPA follow controlled investigation, root-cause, risk, effectiveness, and closure workflows | Governed quality-event lifecycle, structured investigation/root-cause/risk controls, CAPA effectiveness checks, controlled closure signature | quality-event, CAPA, effectiveness, closure-signature, trending tests | Automated pass required plus UAT |
| UR-018 | Equipment lifecycle state, qualification, maintenance, calibration, quarantine, and impact controls are enforced | Equipment registry and status machine, qualification/PM/calibration controls, out-of-service/quarantine gates, impact assessment and escalation | equipment foundation, lifecycle, operations, compliance-impact, quarantine/recall, escalation tests | Automated pass required plus UAT |
| UR-019 | Inventory and material lots preserve lot traceability, acceptance, stock movement, expiration, recall, and disposition controls | Material-lot registry, acceptance/rejection, barcode and transaction ledger, reservation/transfer controls, expiration and recall hard stops | material-lot, inventory-transaction, barcode/reservation, acceptance/recall, transfer, expiry/recall-alert, supplier/procurement tests | Automated pass required plus UAT |
| UR-020 | Laboratory test methods and validation projects enforce controlled configuration, criteria, results, and lifecycle completion gates | Governed test-method configuration plus validation-project status, criterion/result requirements, completion hard stops, tenant authorization | `src/lib/laboratory/validation.test.ts`, validation migration integrity tests, validation-project status tests | Automated pass required plus UAT |
| UR-021 | Finalized reports and governed exports remain attributable and do not expose unapproved mutable database access | Approved reporting views, bounded report generation/export, finalized report state and controlled CSV export | reporting/finalized-report/CSV-export tests | Automated pass required plus UAT |
| UR-022 | External integrations remain read-only, tenant-bound, signed, idempotent, endpoint-safe, and operationally governable | Integration-client RBAC, versioned read-only API, webhook allow-list, durable outbox, HMAC signing, bounded retry/dead-letter, controlled requeue/rotation | integration client/API tests, `webhook-subscriptions.test.ts`, outbox/delivery tests, status-webhook tests | Automated pass required plus UAT |
| UR-023 | AI assistance remains assistive-only, default-deny, tenant-governed, provider/model allow-listed, content-classified, credential-governed, and fully evidence-traced | Tenant AI policy, provider/model profiles, source-content classification gate, credential binding/versioning, JIT preflight, runtime secret resolution, adapter registry/orchestrator, authenticated tenant-bound API, admin diagnostics | `src/lib/ai/ai-governance.test.ts` plus policy, provider, classification, credential, preflight, secret-resolution, adapter, orchestrator, OpenAI-adapter, API, and diagnostics tests | Automated pass required plus UAT and security review |
| UR-024 | AI provider execution must not create regulated approval, signature, lifecycle, compliance-decision, workflow-bypass, or regulated-record mutation authority | Server-owned assistive-only governance boundary and single governed execution path | AI governance and execution-boundary source-contract tests | Automated pass required plus UAT |
| UR-025 | Webhook status publication for governed domains must preserve deterministic identity and metadata-only payload boundaries | Transactional/durable status outbox events for equipment, inventory, quality events, validation projects, and documents | `quality-event-status-webhook-outbox.test.ts`, `validation-project-status-webhook-outbox.test.ts`, webhook subscription/delivery tests | Automated pass required |

## Release-candidate evidence requirements

Before a new release-candidate baseline is promoted, the controlled validation package must establish for each applicable requirement above:

- exact release SHA and package version;
- successful CI and Security runs for that exact SHA;
- applicable migration/integrity evidence;
- mapped test evidence and any required validation-environment execution evidence;
- critical-workflow UAT result, including expected negative/fail-closed cases;
- deviation record for any failed or conditionally accepted result;
- residual-risk owner and approval where applicable;
- final controlled quality, security, and service-owner release decision.

## Scope boundary

This expanded matrix records implementation traceability only. It does not mark any requirement validated, accepted for production, compliant with a regulatory framework, or approved for release. Those conclusions require execution of the controlled validation and release process against a specific immutable candidate.
