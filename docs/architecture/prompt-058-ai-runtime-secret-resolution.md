# Prompt 058 — Governed AI runtime secret resolution

## Purpose

This slice introduces the first runtime-only credential resolution boundary for future AI provider adapters. It composes with the existing governed execution plan and just-in-time preflight controls.

## Control sequence

1. A governed AI execution plan must already exist.
2. `revalidateGovernedAiExecutionPlan(...)` must pass immediately before secret resolution.
3. The runtime secret name must remain in the `AI_PROVIDER_CREDENTIAL_*` namespace and must exactly match the name bound into the governed execution plan.
4. The credential value is read only from the injected runtime environment source.
5. Missing or blank credentials fail closed.
6. The credential value is returned only to the immediate runtime caller.

## Security boundary

The resolved credential value is not:

- written to PostgreSQL;
- added to audit metadata;
- logged;
- returned to an administrative UI;
- copied into the governed execution plan;
- transmitted to a provider in this slice.

This slice introduces no provider SDK, provider endpoint, HTTP call, model invocation, autonomous behavior, or regulated-record mutation authority.

## Testing

Contract tests verify that preflight occurs before secret lookup, only the plan-bound namespaced secret may be resolved, missing secrets fail closed, and the resolver contains no persistence, logging, audit, or network path.
