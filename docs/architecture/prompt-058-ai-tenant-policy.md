# Prompt 058 — Tenant AI Policy Governance

## Purpose

Establish explicit tenant-level governance before any AI model provider or execution path is connected.

## Default posture

AI assistance is disabled unless a tenant administrator with `ai.manage` explicitly enables it.

Each tenant policy controls:

- whether AI assistance is enabled at all;
- which approved assistive use cases are enabled;
- whether an external AI provider may be used;
- whether source QMS content may leave the application boundary.

External-provider permission does not itself authorize source-content egress. Source-content egress requires both flags to be enabled.

## Approved use cases

The policy may enable only the server-owned Prompt 058 allow-list:

- `DOCUMENT_SEARCH`
- `DRAFTING`
- `SUMMARIZATION`
- `CLASSIFICATION`
- `QUALITY_ANALYTICS`

The policy does not expand the regulated authority boundary established in the Prompt 058 foundation.

## Evidence and audit

Every policy change requires an explicit reason and creates:

- the current tenant policy state;
- an append-only `AiTenantPolicyEvent` snapshot;
- an `AI_TENANT_POLICY_UPDATED` audit event.

Policy history cannot be updated or deleted through normal database operations.

## Explicit non-goals

This slice does not:

- connect a model provider;
- add provider credentials;
- send QMS content outside the application;
- create an AI execution endpoint or UI;
- grant AI approval, signature, workflow, lifecycle, compliance-decision, or regulated-record mutation authority.
