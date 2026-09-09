# Prompt 058 — Governed AI Provider Credential Binding

## Purpose

Establish a governed, tenant-scoped credential-binding lifecycle for future AI provider adapters without storing provider credentials in the QMS database or resolving secrets in the governance layer.

## Boundary

This slice remains pre-execution infrastructure. It does not add a provider SDK, HTTP client, endpoint, model call, credential value, secret resolver, prompt/output body store, autonomous behavior, or regulated-record mutation authority.

## Runtime secret reference model

The database stores only a runtime secret name constrained to the `AI_PROVIDER_CREDENTIAL_*` namespace. Credential values remain outside the database in the deployment secret store. The governance service does not call `process.env` and cannot read the secret value.

Each provider profile may have one tenant-scoped credential binding with:

- ACTIVE or INACTIVE lifecycle status
- constrained runtime secret name
- monotonically increasing credential version
- created/updated actor provenance
- append-only lifecycle evidence

Rebinding or rotation requires `ai.manage`, a reason, and increments the credential version. Use requires `ai.assist` and an ACTIVE binding.

## Execution-gateway integration

`prepareGovernedAiExecution` now requires an active credential binding after provider/model and data-egress authorization but before REQUESTED assistance evidence is created. The governed execution plan binds the credential binding ID, runtime secret name, and credential version for a future adapter.

Binding metadata is provenance only. No secret is resolved or exposed by the execution gateway.

## Security properties

- provider credential values are never stored in PostgreSQL
- audit metadata contains only the runtime secret name and credential version
- arbitrary environment-variable names are rejected
- no dynamic environment access exists in this slice
- no network or provider execution occurs
- existing assistive-only and no-regulated-mutation constraints remain unchanged
