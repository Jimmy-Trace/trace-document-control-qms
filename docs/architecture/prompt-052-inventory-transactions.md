# Prompt 052 — Inventory Transactions and Quantity-on-Hand

## Scope
Add governed stock movements and location-aware quantity-on-hand to the Prompt 052 material/lot foundation.

## Controls
- append-only InventoryTransaction evidence for adjustment-in, adjustment-out, and consumption;
- tenant/lot/site/department-scoped InventoryBalance records;
- row locking serializes concurrent balance changes for a lot/location;
- outbound transactions fail closed if they would create negative stock;
- only ACCEPTED, non-expired lots may transact;
- existing balance UOM cannot silently change;
- active same-tenant site/department validation is enforced;
- optional tenant-scoped reference keys are unique for caller-side idempotency;
- every transaction appends transactional audit evidence including resulting quantity-on-hand;
- read access uses `inventory.read`; mutation uses `inventory.manage`.

## Boundary
Transfers between locations, automatic receipt posting from lot receiving, barcode scanning, reservation/allocation, low-stock thresholds, expiration/recall automation, equipment-to-lot usage, analytics, and procurement remain subsequent Prompt 052 slices.