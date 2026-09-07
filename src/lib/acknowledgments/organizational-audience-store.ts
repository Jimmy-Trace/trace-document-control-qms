import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { OrganizationalAudienceStore, OrganizationalAudienceType } from "./organizational-audience";
import { OrganizationalAudienceValidationError } from "./organizational-audience";

export class PrismaOrganizationalAudienceStore implements OrganizationalAudienceStore {
  async listOptions(organizationId: string) {
    const [sites, departments, documents] = await Promise.all([
      db.site.findMany({ where: { organizationId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.department.findMany({ where: { organizationId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      db.documentVersion.findMany({ where: { organizationId, status: "EFFECTIVE" }, select: { id: true, revisionLabel: true, document: { select: { documentNumber: true, title: true } } }, orderBy: { createdAt: "desc" } }),
    ]);
    const siteCounts = await Promise.all(sites.map(async (site) => {
      const rows = await db.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT DISTINCT usm."userId"
        FROM "UserSiteMembership" usm
        JOIN "User" u ON u."organizationId" = usm."organizationId" AND u.id = usm."userId"
        JOIN "UserRole" ur ON ur."organizationId" = u."organizationId" AND ur."userId" = u.id
        JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
        JOIN "Permission" p ON p.id = rp."permissionId"
        WHERE usm."organizationId" = ${organizationId}::uuid AND usm."siteId" = ${site.id}::uuid AND u.status = 'ACTIVE' AND p.key = 'document.acknowledge'
      `);
      return { id: site.id, name: site.name, memberCount: rows.length };
    }));
    const departmentCounts = await Promise.all(departments.map(async (department) => {
      const rows = await db.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT DISTINCT udm."userId"
        FROM "UserDepartmentMembership" udm
        JOIN "User" u ON u."organizationId" = udm."organizationId" AND u.id = udm."userId"
        JOIN "UserRole" ur ON ur."organizationId" = u."organizationId" AND ur."userId" = u.id
        JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
        JOIN "Permission" p ON p.id = rp."permissionId"
        WHERE udm."organizationId" = ${organizationId}::uuid AND udm."departmentId" = ${department.id}::uuid AND u.status = 'ACTIVE' AND p.key = 'document.acknowledge'
      `);
      return { id: department.id, name: department.name, memberCount: rows.length };
    }));
    return {
      sites: siteCounts,
      departments: departmentCounts,
      documents: documents.map((version) => ({ versionId: version.id, documentNumber: version.document.documentNumber, title: version.document.title, revisionLabel: version.revisionLabel })),
    };
  }

  async assignAudience(input: { organizationId: string; audienceType: OrganizationalAudienceType; audienceId: string; versionId: string; dueAt: Date; assignedAt: Date; assignedByUserId: string }) {
    return db.$transaction(async (tx) => {
      const version = await tx.documentVersion.findFirst({ where: { organizationId: input.organizationId, id: input.versionId, status: "EFFECTIVE" }, select: { id: true, documentId: true } });
      if (!version) throw new OrganizationalAudienceValidationError("Only an effective version can be distributed");

      let audienceName = "";
      let recipientRows: Array<{ userId: string }> = [];
      if (input.audienceType === "SITE") {
        const site = await tx.site.findFirst({ where: { organizationId: input.organizationId, id: input.audienceId, active: true }, select: { id: true, name: true } });
        if (!site) throw new OrganizationalAudienceValidationError("Site must be an active tenant site");
        audienceName = site.name;
        recipientRows = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
          SELECT DISTINCT usm."userId"
          FROM "UserSiteMembership" usm
          JOIN "User" u ON u."organizationId" = usm."organizationId" AND u.id = usm."userId"
          JOIN "UserRole" ur ON ur."organizationId" = u."organizationId" AND ur."userId" = u.id
          JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
          JOIN "Permission" p ON p.id = rp."permissionId"
          WHERE usm."organizationId" = ${input.organizationId}::uuid AND usm."siteId" = ${site.id}::uuid AND u.status = 'ACTIVE' AND p.key = 'document.acknowledge'
        `);
      } else {
        const department = await tx.department.findFirst({ where: { organizationId: input.organizationId, id: input.audienceId, active: true }, select: { id: true, name: true } });
        if (!department) throw new OrganizationalAudienceValidationError("Department must be an active tenant department");
        audienceName = department.name;
        recipientRows = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
          SELECT DISTINCT udm."userId"
          FROM "UserDepartmentMembership" udm
          JOIN "User" u ON u."organizationId" = udm."organizationId" AND u.id = udm."userId"
          JOIN "UserRole" ur ON ur."organizationId" = u."organizationId" AND ur."userId" = u.id
          JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
          JOIN "Permission" p ON p.id = rp."permissionId"
          WHERE udm."organizationId" = ${input.organizationId}::uuid AND udm."departmentId" = ${department.id}::uuid AND u.status = 'ACTIVE' AND p.key = 'document.acknowledge'
        `);
      }

      const recipientUserIds = [...new Set(recipientRows.map((row) => row.userId))];
      if (!recipientUserIds.length) throw new OrganizationalAudienceValidationError("Audience has no active acknowledgment-enabled recipients");
      const existing = await tx.acknowledgmentAssignment.findMany({ where: { organizationId: input.organizationId, documentVersionId: version.id, assignedToUserId: { in: recipientUserIds } }, select: { assignedToUserId: true } });
      const existingIds = new Set(existing.map((row) => row.assignedToUserId));
      const newRecipients = recipientUserIds.filter((userId) => !existingIds.has(userId));
      if (newRecipients.length) await tx.acknowledgmentAssignment.createMany({ data: newRecipients.map((userId) => ({ organizationId: input.organizationId, documentId: version.documentId, documentVersionId: version.id, assignedToUserId: userId, assignedByUserId: input.assignedByUserId, assignedAt: input.assignedAt, dueAt: input.dueAt })) });
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.assignedByUserId, action: "DOCUMENT_ACKNOWLEDGMENT_ORGANIZATIONAL_AUDIENCE_ASSIGNED", entityType: "DocumentVersion", entityId: version.id, occurredAt: input.assignedAt, metadata: { audienceType: input.audienceType, audienceId: input.audienceId, audienceName, recipientUserIds, createdRecipientUserIds: newRecipients, skippedExisting: recipientUserIds.length - newRecipients.length, dueAt: input.dueAt.toISOString() } } });
      return { created: newRecipients.length, skippedExisting: recipientUserIds.length - newRecipients.length, recipientUserIds };
    });
  }
}
