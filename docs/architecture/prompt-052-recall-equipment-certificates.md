# Prompt 052 — Recall, Equipment Use, and Acceptance Evidence

## Scope
Add governed manufacturer recall propagation, lot-to-equipment usage traceability, and acceptance-certificate evidence on top of the established material/lot and equipment identities.

## Controls
- manufacturer recalls are tenant-scoped and keyed by an external recall reference;
- one recall can affect multiple governed material lots;
- affected usable lots are moved to `RECALLED` with append-only lot-status evidence;
- recalled lots are therefore blocked by existing accepted-only transaction, reservation, transfer, and consumption gates;
- recall evidence may reference an AVAILABLE governed file;
- lot-to-equipment usage records bind the exact lot, equipment, operational reference, optional quantity/UOM, timestamp, and human actor;
- equipment-use evidence is append-only and requires an ACCEPTED lot and ACTIVE equipment;
- acceptance certificates bind a received/quarantined lot to an AVAILABLE governed evidence file and accepting user;
- all human-triggered writes require `inventory.manage` and append audit history.

## Boundary
This slice records acceptance evidence but does not yet make a certificate a mandatory precondition for every ACCEPTED transition; that enforcement will be introduced together with the detailed receiving/acceptance workflow so existing acceptance paths are not silently broken. Recall notifications/impact workspace, barcode label printing, analytics, and procurement remain subsequent Prompt 052 slices.
