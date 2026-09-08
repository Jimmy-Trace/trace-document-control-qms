# Prompt 052 — Reservation Fulfillment and Inventory Automation

## Scope
Add controlled reservation consumption, automatic expiration hard stops, and deduplicated low-stock escalation without weakening the append-only inventory ledger.

## Controls
- active reservations can be fulfilled exactly once into a governed `CONSUMPTION` transaction;
- reservation fulfillment and physical balance decrement commit atomically;
- reservation-to-transaction binding is tenant-enforced at the database layer;
- expired or no-longer-accepted reserved lots cannot be consumed;
- accepted lots past expiration are automatically moved to `EXPIRED` with system-origin append-only status evidence;
- human and system lot-status evidence are mutually exclusive at the database layer;
- system automation never impersonates a human actor;
- a `CRON_SECRET`-protected internal endpoint evaluates all tenants without manufacturing a user identity;
- low-stock events escalate at 1, 7, and 30 days;
- one append-only automation event is recorded per threshold crossing;
- automation-to-low-stock-event binding is tenant-enforced at the database layer;
- notifications are deduplicated and delivered to active users holding `inventory.manage`;
- all human-triggered operations retain `inventory.manage` authorization.

## Boundary
Explicit manufacturer recall intake/propagation, equipment-to-lot usage traceability, acceptance certificates, inventory analytics/workspace, label printing, and procurement remain subsequent Prompt 052 slices.
