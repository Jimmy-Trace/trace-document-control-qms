# Prompt 058 — Governed AI assistance API

## Purpose
Expose the governed AI execution pipeline through one authenticated server endpoint without creating a second authorization or provider path.

## Boundary
- `POST /api/ai/assist` derives the organization from the authenticated request context; clients cannot select another tenant.
- The endpoint accepts only the five approved assistive use cases and provider identity `OPENAI`.
- Model approval, tenant AI policy, source-content egress/classification, credential binding, just-in-time preflight, secret resolution, provider selection, provider execution, and terminal evidence remain enforced by the existing governed orchestrator.
- Source entity type/ID are paired and source content requires an explicit classification.
- Input is capped at 50,000 characters at the HTTP boundary.
- The response returns only correlation ID, use case, provider/model provenance, and assistive output text. Credential data and provider request identifiers are not exposed.

## Regulated-system boundary
This endpoint does not approve records, create electronic signatures, perform lifecycle transitions, bypass human review, make compliance determinations, or mutate regulated records. AI output remains assistive material requiring normal governed human action before it can affect a controlled record.
