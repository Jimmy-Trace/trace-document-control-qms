# Prompt 052 — Inventory Workspace and Governed Labels

## Scope
Add operational inventory analytics and governed lot-label issuance without weakening the append-only inventory ledger or lot identity controls.

## Controls
- inventory.read users can retrieve tenant-scoped operational summary metrics;
- workspace metrics are derived from governed materials, lots, balances, reservations, low-stock events, and recall-impact evidence;
- label issuance requires inventory.manage;
- labels can only be issued for a lot with an assigned governed barcode;
- every label issuance records append-only evidence containing the exact barcode, material identity, lot number, status, expiration date, issuer, and timestamp;
- label issuance appends audit history and does not mutate the underlying lot identity or barcode assignment.

## Boundary
Procurement and supplier ordering remain the final Prompt 052 bounded-context slice. Physical printer integration remains an external delivery concern; this slice produces the governed label payload and issuance evidence that a printer adapter can consume.