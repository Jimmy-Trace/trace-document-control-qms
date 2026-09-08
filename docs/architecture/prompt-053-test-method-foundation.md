# Prompt 053 — Test and Method Management Foundation

## Scope
Begin the next Laboratory Operations bounded context after Equipment and Reagents/Lots by establishing governed laboratory test identities, method identities, and immutable method-version evidence.

## Controls
- laboratory tests are tenant-scoped and uniquely coded;
- laboratory methods are tenant-scoped, uniquely coded, and bound to an exact governed test identity;
- method versions are append-only immutable snapshots with monotonically unique version labels per method;
- optional method-procedure evidence must reference an AVAILABLE same-tenant governed file;
- reads require `lab_test.read`; regulated creation/versioning requires `lab_test.manage`;
- every regulated write retains human actor attribution and audit evidence;
- method/test activation is deliberately not exposed in this foundation slice.

## Lifecycle boundary
Tests and methods begin in DRAFT. RETIRED is terminal. Transition into an operational ACTIVE state will be introduced only after the subsequent validation-project/results slice can enforce validation evidence and release criteria.

## Architecture sequence
The repository database architecture orders Laboratory Operations as equipment, reagents/lots, tests, methods, validation projects/results, and proficiency-testing programs/events. Prompt 053 follows that sequence.
