# Documents workspace navigation

## Purpose

Organize the Documents view into a clearer hierarchy before release-candidate visual acceptance.

## Current composition

The authenticated dashboard owns the live controlled-document library and private controlled-file panels. The QMS module shell owns governed document-operation launchers and controlled-copy administration. These surfaces intentionally retain their existing service calls, permission gates, audit behavior, and lifecycle semantics.

## Presentation target

The Documents experience is reviewed as four conceptual areas:

1. **Library** — controlled documents, search, status filters, pagination, and document detail access.
2. **Files** — private controlled-file upload, malware-scan state, integrity, and draft binding.
3. **Document tools** — controlled submission, lifecycle operations, acknowledgments, distribution, folders, and retention/holds.
4. **Controlled copies** — numbered controlled-copy issuance and reconciliation.

This change is presentation/information-architecture work only. It must not introduce new document APIs, bypass existing authorization, change document lifecycle transitions, alter file quarantine/scanning requirements, or modify append-only audit/evidence behavior.

## Implementation constraint

The live Library and Files panels remain owned by `DocumentControlDashboard`; document tools and controlled copies remain owned by `QmsModuleShell`. The visual organization should therefore preserve component ownership rather than duplicating regulated workflows or reimplementing their API clients merely to change page layout.

## Visual acceptance

Railway product-review acceptance should confirm that Library/Files are presented as focused document content, Document tools/Controlled copies remain clearly grouped as document operations, and no duplicated Review Management workspace is exposed in the Documents module shell.