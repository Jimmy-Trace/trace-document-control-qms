# Prompt 058 — AI Source Content Classification and Egress Gate

## Purpose

This slice closes the gap between a broad tenant-level source-content egress flag and the actual sensitivity of QMS source content. Future external AI execution must not treat all source content as equivalent.

## Classification model

The governed source-content classes are:

- `NON_SENSITIVE`
- `CONTROLLED_QMS`
- `PERSONNEL_CONFIDENTIAL`
- `SECURITY_SECRET`

`SECURITY_SECRET` is a platform-level hard prohibition for external AI egress. It cannot be added to a tenant allow-list.

## Default-deny behavior

Migration `0079_ai_source_content_classification` adds `allowedSourceContentClasses` to the tenant AI policy and its append-only policy history. Existing and new policy rows default to an empty array.

Therefore, `allowSourceContentEgress=true` is not sufficient by itself. A source-content class must also be explicitly approved by tenant policy before the provider guard succeeds.

## Execution contract

When `includesSourceContent=true`, the governed execution gateway requires `sourceContentClass` before provider authorization or request evidence creation. The class is passed through the provider authorization boundary and is bound into the resulting `GovernedAiExecutionPlan`.

The gateway also rejects a classification when no source content is included, preventing ambiguous or misleading evidence.

## Governance boundary

This slice does not add:

- provider SDKs or adapters;
- provider credentials, tokens, or secrets;
- provider endpoints;
- HTTP/network calls;
- prompt or output body storage;
- autonomous behavior;
- regulated record mutation, approval, signature, lifecycle transition, or workflow bypass authority.

The existing assistive-only Prompt 058 governance boundary remains unchanged.

## Evidence

Tenant policy history and audit metadata include the approved source-content class allow-list. AI request/output evidence continues to store hashes and provenance rather than prompt/output bodies.

## Next-step constraint

A future provider execution adapter may only be introduced after it consumes the governed execution plan and preserves the provider/model, tenant, use-case, source-content-class, egress, and assistive-only boundaries established by Prompt 058.
