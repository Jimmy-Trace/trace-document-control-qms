# Prompt 058 — Governed AI Assistance Foundation

## Purpose

Establish the controlled boundary required before any AI/model provider can be connected to the QMS. AI remains assistive and cannot exercise regulated decision authority.

## Approved assistive use cases

The server-owned allow-list is intentionally limited to:

- document search;
- drafting assistance;
- summarization;
- classification;
- quality analytics.

Adding another use case requires an explicit implementation change and review; browser clients cannot invent new AI authorities.

## Regulated authority boundary

AI assistance is advisory only. This foundation explicitly denies AI authority to:

- approve controlled records;
- create electronic signatures;
- alter regulated history;
- perform document or QMS lifecycle transitions;
- bypass required human review;
- make authoritative compliance determinations;
- mutate regulated records.

Human accountability remains explicit for every regulated action.

## Authorization

- `ai.assist` authorizes use of approved assistive capabilities.
- `ai.manage` is reserved for governed AI policy/operational administration.
- Both permissions are initially granted to the System Administrator role only; later role assignment remains governed by the existing RBAC system.

## Evidence and privacy boundary

`AiAssistanceEvent` is a tenant-scoped append-only evidence ledger.

It records:

- correlation ID;
- approved use case;
- request/outcome event type;
- optional source entity reference;
- SHA-256 input/output fingerprints;
- provider/model provenance for completed assistance;
- responsible authenticated user;
- timestamp.

Prompt/input bodies and generated output bodies are deliberately not stored in this evidence ledger. Existing governed records remain the authoritative location for any content a human later chooses to incorporate through normal controlled workflows.

Each correlation permits one request event and one terminal outcome event. Completed outcomes require provider and model provenance.

## Provider boundary

This slice does **not** connect OpenAI or any other model provider, send QMS data externally, create a model API endpoint, or configure provider credentials. Provider selection, data-minimization rules, model execution, and user-facing assistance will be separate bounded Prompt 058 slices after this governance foundation is validated.

## Validation intent

Automated source-contract tests verify the use-case allow-list, least-privilege permissions, deny-only regulated authority boundary, hash/provenance-only evidence model, append-only enforcement, and completed-outcome provenance requirements.
