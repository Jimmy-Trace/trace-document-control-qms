# Prompt 057 — Equipment Status Reference API

## Purpose
Extend the authenticated external QMS reference surface with bounded, tenant-scoped equipment status metadata required by downstream laboratory or business systems.

## Controls
- endpoint is versioned under `/api/v1/qms/equipment/status`;
- bearer authentication uses the existing governed `IntegrationClient` credential boundary;
- access requires the existing `qms.read` integration scope;
- tenant identity is derived exclusively from the authenticated integration client;
- response size is bounded to 1–100 records;
- successful reads append `IntegrationAccessEvent` evidence using resource `equipment-status`;
- no external equipment mutation, lifecycle transition, calibration/maintenance evidence write, or compliance-hold clearance is exposed.

## Exposed reference metadata
- equipment identifier and equipment number;
- name, manufacturer, model and serial number;
- lifecycle status;
- site and department identifiers;
- calibration-required and next calibration due date;
- maintenance-required and next maintenance due date;
- count of uncleared equipment compliance holds;
- derived `operationallyUsable` indicator.

## Availability rule
`operationallyUsable` is true only when governed equipment status is `ACTIVE` and no uncleared `EquipmentComplianceHold` exists. This preserves the existing equipment compliance architecture where overdue required calibration or preventive maintenance creates a separate compliance hold that makes active equipment operationally unusable without silently rewriting lifecycle status.

## Boundary
This slice does not expose equipment event history, service narratives, evidence-file bytes, impact assessments, recall records, user identities, quality-event details, external writes, webhooks, subscriptions, instrument interfaces or inbound LIMS commands.
