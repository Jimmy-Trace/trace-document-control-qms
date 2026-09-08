# Prompt 052 — Reagents / Lots / Inventory Foundation

## Scope
Establish governed tenant-scoped material and lot identities before adding inventory transactions or equipment/material traceability.

## Controls
- `Material` is the stable catalog identity for reagents, controls, consumables, and other governed laboratory materials.
- `MaterialLot` is the received lot identity, bound to a material, tenant, optional site/department, receipt date, expiration date, quantity/UOM, and optional governed evidence.
- lots begin in `RECEIVED`; acceptance is an explicit governed transition rather than an implicit consequence of receipt.
- lifecycle supports acceptance, quarantine, rejection, expiration, recall, and depletion with append-only `MaterialLotStatusChange` evidence.
- expired lots cannot be accepted.
- `inventory.read` and `inventory.manage` are dedicated least-privilege permissions.
- all regulated writes append audit evidence.
- tenant-bound foreign keys protect material, location, evidence, and actor relationships.

## Boundary
This foundation intentionally does not yet model stock movements, quantity-on-hand, barcode workflows, automated expiration hard stops, recall propagation, certificates/acceptance detail, equipment-to-lot usage, or procurement. Those controls build on these governed identities in subsequent Prompt 052 slices.