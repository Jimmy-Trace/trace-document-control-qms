# Prompt 058 — Governed AI Execution Gateway

## Purpose

Establish the mandatory server-side authorization and evidence boundary that every future external AI execution must pass through before any provider adapter, credential, or network call is introduced.

## Preconditions

An external AI execution is eligible only when all of the following are true:

1. the user has `ai.assist` authorization in the tenant;
2. the requested use case is one of the approved assistive AI use cases;
3. the tenant AI policy is enabled for that use case;
4. external-provider use is enabled by tenant policy;
5. the provider profile is ACTIVE;
6. the requested model is explicitly present in the provider profile allow-list;
7. if source QMS content is included, both tenant policy and provider profile permit source-content egress.

## Gateway behavior

`prepareGovernedAiExecution(...)` performs the policy checks first, then records append-only `REQUESTED` evidence and returns a governed execution plan containing:

- correlation ID;
- tenant ID;
- approved use case;
- approved provider-profile ID;
- provider and model provenance;
- input SHA-256 fingerprint;
- optional source entity reference;
- whether source-content egress was approved;
- the existing assistive-only governance boundary.

`recordGovernedAiExecutionOutcome(...)` records the terminal outcome using the provider/model provenance bound into the approved execution plan. Cross-tenant plan reuse is rejected.

## Regulated authority boundary

The gateway does not grant AI authority to:

- approve controlled records;
- create electronic signatures;
- alter regulated history;
- perform lifecycle or workflow transitions;
- bypass required human review;
- make authoritative compliance determinations;
- mutate regulated records.

The execution plan must remain assistive-only.

## Explicitly out of scope

This slice adds no:

- provider SDK;
- API key, token, client secret, or credential store;
- provider endpoint configuration;
- HTTP/network call;
- model execution endpoint or UI;
- autonomous agent behavior;
- regulated write path.

A later provider adapter must consume this gateway rather than bypassing it.
