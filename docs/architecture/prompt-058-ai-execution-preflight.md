# Prompt 058 — Governed AI Execution Preflight

## Purpose

Close the time-of-check/time-of-use gap between governed AI plan preparation and any future provider execution.

A plan that was valid when prepared must not remain executable after tenant policy, source-content egress policy, provider/model approval, or credential state changes.

## Required preflight

Immediately before any future provider adapter may execute, the application must revalidate the prepared `GovernedAiExecutionPlan` through `revalidateGovernedAiExecutionPlan`.

The preflight rechecks:

- organization/tenant identity;
- the assistive-only/no-regulated-mutation governance boundary;
- the tenant-enabled AI use case;
- external-provider permission;
- source-content egress permission and source-content class, when applicable;
- active provider profile and approved model;
- provider profile identity originally bound into the plan;
- active credential binding;
- credential binding identity;
- credential version; and
- runtime secret-name binding.

## Fail-closed drift behavior

The preflight does not substitute current authorization into an old plan. If any bound provider or credential provenance has changed after plan preparation, the plan is rejected and a new governed plan must be prepared.

This prevents a stale plan from surviving:

- provider deactivation;
- model removal;
- tenant AI-policy disablement;
- source-content class revocation;
- credential deactivation;
- credential rebinding; or
- credential rotation/version advancement.

## Security boundary

This slice does not:

- resolve the runtime secret name;
- read `process.env`;
- store or return provider credential values;
- add a provider SDK or provider-specific adapter;
- add a network/HTTP request;
- execute a model; or
- grant AI any regulated-record mutation, approval, signature, lifecycle-transition, or workflow-bypass authority.

A future provider adapter must consume only a plan that has passed this just-in-time preflight.
