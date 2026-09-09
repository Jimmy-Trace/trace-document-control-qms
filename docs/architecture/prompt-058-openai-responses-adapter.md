# Prompt 058 — Governed OpenAI Responses adapter

## Purpose

This slice adds the first concrete external AI provider implementation behind the previously merged governed execution boundaries. It implements only the provider adapter contract for provider identity `OPENAI` and does not create a new authorization or execution path.

## Runtime contract

The adapter sends a single `POST https://api.openai.com/v1/responses` request using the model already bound into the governed execution plan and the input passed by the governed orchestrator. Runtime credentials are supplied only at the immediate adapter boundary.

The request sets `store: false`, does not enable tools, does not enable background execution, and does not introduce retries. A hard timeout aborts long-running requests.

## Response handling

The adapter accepts only successful JSON responses whose status is `completed`. Text is extracted only from `output_text` content parts. Missing text, incomplete responses, malformed payloads, non-JSON responses, provider mismatch, HTTP failures, and oversized output all fail closed.

The provider response ID may be returned for operational correlation, but credentials and response bodies are not persisted or logged by this adapter.

## Governance boundary

This implementation does not grant any approval, signature, lifecycle-transition, compliance-determination, workflow-bypass, or regulated-record mutation authority. All execution remains dependent on the existing tenant policy, provider/model allow-list, source-content classification gate, credential binding, execution preflight, runtime secret resolution, adapter registry, and governed orchestrator.

No database schema change is introduced in this slice.
