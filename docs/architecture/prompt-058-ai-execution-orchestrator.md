# Prompt 058 — Governed AI execution orchestrator

## Purpose

This slice composes the previously approved AI governance layers into one controlled runtime path. It does not add a vendor-specific provider implementation.

## Execution sequence

1. Prepare a governed execution plan and create REQUESTED evidence.
2. Revalidate the plan and resolve only the plan-bound runtime credential.
3. Require an adapter whose provider identity exactly matches the plan.
4. Build the narrow provider request and invoke the adapter.
5. Validate the provider response.
6. Record COMPLETED evidence using output hashing and provider/model provenance.
7. If any downstream step fails after plan creation, record FAILED terminal evidence before rethrowing the failure.

## Failure-evidence rule

Once REQUESTED evidence exists, the orchestrator must not silently abandon the correlation. A downstream failure attempts to append FAILED evidence. If that terminal evidence itself cannot be written, the orchestrator raises an explicit evidence-recording error rather than masking the traceability failure.

## Data handling

Credential values, prompt/input bodies, and provider output bodies remain runtime-only except for the existing SHA-256 evidence hashes. The orchestrator does not write directly to PostgreSQL or audit logs and does not log those values.

## Governance boundary

The orchestration layer does not grant approval, signature, lifecycle-transition, workflow-bypass, compliance-decision, or regulated-record mutation authority. Provider-specific SDKs/endpoints remain outside this slice.
