# Prompt 052 — Certificate-Backed Acceptance and Recall Impact

## Scope
Close the receiving/acceptance control gap and automatically capture operational impact when a governed material recall affects a previously used lot.

## Controls
- every transition into `ACCEPTED` is blocked unless the lot already has governed acceptance-certificate evidence;
- the acceptance requirement is enforced at the database boundary so alternate APIs or future services cannot bypass it;
- existing receipt posting still occurs only after a successful ACCEPTED transition;
- manufacturer recall linkage automatically snapshots prior lot-to-equipment usage;
- the recall-impact snapshot records prior use count, distinct affected equipment count, and earliest/latest recorded use;
- recall-impact evidence is append-only and tenant-scoped;
- users with `inventory.read` can retrieve recall-impact evidence through a tenant-scoped API.

## Boundary
Recall notification/escalation workflow, user disposition/closure of recall impact, inventory analytics/workspace, barcode label printing, and procurement remain subsequent Prompt 052 slices.
