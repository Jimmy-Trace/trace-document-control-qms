# Prompt 052 — Barcode, Reservations, and Low-Stock Controls

## Scope
Add operational identification, allocation, and replenishment signals without weakening the append-only inventory ledger.

## Controls
- tenant-unique optional barcode values resolve directly to governed material lots;
- barcode assignment is audited and never replaces the lot identifier;
- active reservations allocate accepted, non-expired inventory without reducing physical quantity-on-hand;
- available inventory is enforced as on-hand minus active reservations;
- reservation reference keys are tenant-unique for caller-side idempotency;
- reservation release is controlled and audited;
- configurable material/location low-stock thresholds are tenant scoped;
- low-stock evaluation opens one unresolved event per threshold and resolves it automatically once stock recovers;
- regulated mutations require `inventory.manage`; barcode lookup requires `inventory.read`.

## Boundary
Reservation consumption/fulfillment, barcode label printing, expiration/recall automation, notifications/escalation, equipment-to-lot usage, analytics, certificates/acceptance detail, and procurement remain subsequent Prompt 052 slices.
