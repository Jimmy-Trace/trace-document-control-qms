import { db } from "../db";
import type { RoleAudienceStore } from "./role-audience";
import { RoleAudienceValidationError } from "./role-audience";

export class PrismaRoleAudienceStore implements RoleAudienceStore {
  async listOptions(organizationId: string) {
    const [roles, documents] = await Promise.all([
      db.role.findMany({
        where: {
          organizationId,
          permissions: { some: { permission: { key: "document.acknowledge" } } },
        },
        select: {
          id: true,
          name: true,
          _count: { select: { users: { where: { user: { status: "ACTIVE" } } } } },
        },
        orderBy: { name: "asc" },
      }),
      db.documentVersion.findMany({
        where: { organizationId, status: "EFFECTIVE" },
        select: {
          id: true,
          revisionLabel: true,
          document: { select: { documentNumber: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      roles: roles.map((role) => ({ id: role.id, name: role.name, memberCount: role._count.users })),
      documents: documents.map((version) => ({ versionId: version.id, documentNumber: version.document.documentNumber, title: version.document.title, revisionLabel: version.revisionLabel })),
    };
  }

  async assignRole(input: { organizationId: string; roleId: string; versionId: string; dueAt: Date; assignedAt: Date; assignedByUserId: string }) {
    return db.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: {
          organizationId: input.organizationId,
          id: input.roleId,
          permissions: { some: { permission: { key: "document.acknowledge" } } },
        },
        select: { id: true, name: true },
      });
      if (!role) throw new RoleAudienceValidationError("Role must be an acknowledgment-enabled tenant role");

      const version = await tx.documentVersion.findFirst({
        where: { organizationId: input.organizationId, id: input.versionId, status: "EFFECTIVE" },
        select: { id: true, documentId: true },
      });
      if (!version) throw new RoleAudienceValidationError("Only an effective version can be distributed");

      const memberships = await tx.userRole.findMany({
        where: { organizationId: input.organizationId, roleId: role.id, user: { status: "ACTIVE" } },
        select: { userId: true },
      });
      const recipientUserIds = [...new Set(memberships.map((membership) => membership.userId))];
      if (!recipientUserIds.length) throw new RoleAudienceValidationError("Role has no active recipients");

      const existing = await tx.acknowledgmentAssignment.findMany({
        where: { organizationId: input.organizationId, documentVersionId: version.id, assignedToUserId: { in: recipientUserIds } },
        select: { assignedToUserId: true },
      });
      const existingIds = new Set(existing.map((row) => row.assignedToUserId));
      const newRecipients = recipientUserIds.filter((userId) => !existingIds.has(userId));

      if (newRecipients.length) {
        await tx.acknowledgmentAssignment.createMany({
          data: newRecipients.map((userId) => ({
            organizationId: input.organizationId,
            documentId: version.documentId,
            documentVersionId: version.id,
            assignedToUserId: userId,
            assignedByUserId: input.assignedByUserId,
            assignedAt: input.assignedAt,
            dueAt: input.dueAt,
          })),
        });
      }

      await tx.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.assignedByUserId,
          action: "DOCUMENT_ACKNOWLEDGMENT_ROLE_AUDIENCE_ASSIGNED",
          entityType: "DocumentVersion",
          entityId: version.id,
          occurredAt: input.assignedAt,
          metadata: {
            roleId: role.id,
            roleName: role.name,
            recipientUserIds,
            createdRecipientUserIds: newRecipients,
            skippedExisting: recipientUserIds.length - newRecipients.length,
            dueAt: input.dueAt.toISOString(),
          },
        },
      });

      return { created: newRecipients.length, skippedExisting: recipientUserIds.length - newRecipients.length, recipientUserIds };
    });
  }
}
