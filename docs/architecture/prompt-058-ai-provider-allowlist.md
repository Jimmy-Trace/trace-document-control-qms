# Prompt 058 — Governed AI Provider and Model Allow-list

## Purpose

This slice continues Prompt 058 after tenant AI policy governance. It closes the gap between a tenant permitting external-provider use and the system knowing which provider/model combinations are actually approved.

## Governance model

External AI use is deny-by-default and requires all of the following:

1. the user has `ai.assist`;
2. the tenant AI policy is enabled;
3. the requested assistive use case is enabled;
4. tenant policy allows external-provider use;
5. an ACTIVE provider profile exists for the requested provider;
6. the requested model is explicitly present in that profile's approved model list;
7. when source-content egress is required, both tenant policy and the provider profile allow it.

Provider-profile administration requires `ai.manage` and an explicit change reason.

## Provider profiles

Provider profiles contain governance metadata only:

- tenant-scoped code;
- provider name;
- ACTIVE/INACTIVE status;
- approved model names;
- provider-profile source-content-egress permission;
- creator/updater and timestamps.

This slice intentionally does **not** store API keys, bearer tokens, client secrets, endpoints, or other provider credentials.

## Evidence

Every provider-profile create/update writes an append-only `AiProviderProfileEvent` snapshot and a normal `AuditEvent` entry. Provider-profile history cannot be updated or deleted through normal database mutation.

## Regulated authority boundary

The Prompt 058 assistive-only boundary remains unchanged. Provider approval does not grant AI authority to:

- approve controlled records;
- create electronic signatures;
- alter regulated history;
- execute lifecycle transitions;
- bypass required human review;
- make authoritative compliance determinations;
- mutate regulated records.

## Execution boundary

No model provider is called by this slice. No QMS content is transmitted externally. The allow-list guard is a prerequisite control for a future execution adapter, not an execution adapter itself.
