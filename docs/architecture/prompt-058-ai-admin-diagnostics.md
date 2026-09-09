# Prompt 058 — AI administration diagnostics

This slice adds read-only administrator visibility into governed AI configuration and recent execution evidence.

## Boundary

- Access requires the existing `ai.manage` permission and is tenant-bound from the authenticated request context.
- The endpoint exposes tenant policy, provider profiles, credential-binding metadata, and the 100 most recent AI assistance evidence events.
- Credential values are never resolved or returned. Only the governed runtime secret name, lifecycle status, and credential version are visible.
- Input and output bodies are not returned; only existing SHA-256 evidence and provider/model provenance are exposed.
- No policy, provider, credential, workflow, approval, signature, or regulated-record mutation is performed by this endpoint.

## Endpoint

`GET /api/admin/ai/diagnostics`

The response is intended for an administrative diagnostics surface and remains read-only.
