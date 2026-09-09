# Prompt 058 — Governed AI provider adapter contract

## Purpose

Define the narrow provider-adapter boundary that future AI provider implementations must satisfy after governance, just-in-time preflight, and runtime secret resolution have already succeeded.

## Contract

- adapters are registered by exact provider name
- duplicate provider registrations are rejected
- the execution plan remains the source of truth for the approved provider/model context
- runtime input and credential are passed only to the immediate adapter boundary
- provider output must be nonblank before downstream handling
- an optional provider request identifier may be returned for operational correlation

## Security boundary

This slice does not implement any provider SDK, HTTP client, endpoint, network request, or model execution. It also does not persist or audit the runtime credential, input body, or output body.

A future execution slice must resolve the credential only after the governed execution preflight succeeds, select an adapter whose exact provider identity matches the plan, invoke that adapter, and record terminal governed evidence without granting regulated-record mutation authority.
