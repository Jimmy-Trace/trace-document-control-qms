# Prompt 052 — Transfers and Receipt Posting

## Scope
Extend governed inventory transactions with automatic receipt-to-stock posting and atomic location-to-location transfers.

## Controls
- accepting a received lot automatically posts its recorded received quantity to the lot's governed site/department balance exactly once;
- receipt posting creates append-only `RECEIPT` transaction evidence and audit history;
- `MaterialLot.receiptPostedAt` records completion of the posting boundary;
- transfers require an ACCEPTED, non-expired lot and sufficient source stock;
- source and destination must differ;
- active same-tenant location validation applies to both transfer endpoints;
- source decrement, destination increment, paired `TRANSFER_OUT`/`TRANSFER_IN` ledger entries, and audit evidence commit atomically;
- transfer keys bind paired ledger entries and prevent duplicate directional posting;
- unit-of-measure consistency is enforced at both locations;
- negative source stock is impossible.

## Boundary
Barcode scanning, reservations/allocation, low-stock thresholds, expiration/recall automation, equipment-to-lot traceability, inventory analytics, certificates/acceptance detail, and procurement remain subsequent Prompt 052 slices.