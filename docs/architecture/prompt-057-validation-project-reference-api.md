# Prompt 057 — Validation project reference API

## Objective
Expose bounded, tenant-scoped laboratory validation project lifecycle metadata through the existing external integration authentication boundary.

## External contract
- `GET /api/v1/qms/laboratory/validation/projects/status`
- IntegrationClient bearer authentication is required.
- Existing `qms.read` scope is required.
- Tenant identity is derived only from the authenticated integration client.
- Results are bounded by the shared 1–100 record limit contract.

## Exposed metadata
- validation project identifier and project number;
- laboratory method and method-version identifiers;
- validation project lifecycle status (`DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`);
- started/completed timestamps.

## Explicitly excluded
- validation title/objective text;
- criterion descriptions or acceptance rules;
- observed results, evidence files, performer identities, audit reasons, or signatures;
- laboratory method/test mutation;
- validation result entry or lifecycle transitions;
- any caller-supplied organization identifier.

Successful reads append `IntegrationAccessEvent` evidence with resource `validation-project-status`.
