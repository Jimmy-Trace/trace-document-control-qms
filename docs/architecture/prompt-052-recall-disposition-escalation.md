# Prompt 052 — Recall Disposition, Closure, and Escalation

## Scope
Add governed follow-through after manufacturer recall detection so recalled-lot impact is dispositioned, closed with evidence, and escalated until all impact items are resolved.

## Controls
- recall impact snapshots remain immutable;
- disposition and closure are separate append-only action events;
- closure requires a prior disposition;
- closed impact items cannot be redispositioned;
- open recall impacts generate an initial notification plus 1/7/30-day escalation evidence;
- escalation events and notification keys are idempotent;
- notifications target active users with `inventory.manage`;
- a CRON_SECRET-protected all-tenant endpoint runs recall escalation without impersonating a human user;
- human disposition and closure actions require `inventory.manage` and append audit history.

## Boundary
Inventory analytics/workspace, barcode label printing, and procurement remain subsequent Prompt 052 slices.