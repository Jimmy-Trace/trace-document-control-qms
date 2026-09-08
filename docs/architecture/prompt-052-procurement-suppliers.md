# Prompt 052 — Supplier and Procurement Controls

## Scope
Complete the Prompt 052 inventory bounded context with governed supplier master data, purchase orders, ordered-material line items, and receipt linkage into governed material lots.

## Controls
- suppliers are tenant-scoped, uniquely numbered, and status controlled;
- procurement uses dedicated `procurement.read` and `procurement.manage` permissions;
- purchase orders begin in DRAFT and follow controlled status transitions;
- purchase order lines reference active governed materials with quantity/UOM and optional unit price;
- receipts are append-only and link an ordered line to the exact governed material lot received;
- receipt material identity and UOM must match the purchase-order line;
- cumulative receipts cannot exceed ordered quantity;
- PO status derives to PARTIALLY_RECEIVED or RECEIVED based on outstanding line quantities;
- PO lifecycle evidence is append-only and human-attributed;
- all regulated writes append audit history.

## Boundary
Accounts payable, supplier invoicing, payment processing, and ERP synchronization remain outside Prompt 052. The procurement boundary ends at controlled ordering and receipt into governed inventory.