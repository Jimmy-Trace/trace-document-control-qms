import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { MembershipOptions, MembershipStore } from "./service";
import { MembershipValidationError } from "./service";

export class PrismaMembershipStore implements MembershipStore {
  async listOptions(organizationId: string): Promise<MembershipOptions> {
    const [users, sites, departments, siteMemberships, departmentMemberships] = await Promise.all([
      db.user.findMany({ where: { organizationId }, select: { id: true, firstName: true, lastName: true, email: true, status: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      db.site.findMany({ where: { organizationId }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
      db.department.findMany({ where: { organizationId }, select: { id: true, name: true, siteId: true, active: true }, orderBy: { name: "asc" } }),
      db.$queryRaw<Array<{ userId: string; siteId: string }>>(Prisma.sql`SELECT "userId", "siteId" FROM "UserSiteMembership" WHERE "organizationId" = ${organizationId}::uuid`),
      db.$queryRaw<Array<{ userId: string; departmentId: string }>>(Prisma.sql`SELECT "userId", "departmentId" FROM "UserDepartmentMembership" WHERE "organizationId" = ${organizationId}::uuid`),
    ]);
    const sitesByUser = new Map<string, string[]>();
    const departmentsByUser = new Map<string, string[]>();
    for (const row of siteMemberships) sitesByUser.set(row.userId, [...(sitesByUser.get(row.userId) ?? []), row.siteId]);
    for (const row of departmentMemberships) departmentsByUser.set(row.userId, [...(departmentsByUser.get(row.userId) ?? []), row.departmentId]);
    return {
      users: users.map((user) => ({ id: user.id, name: `${user.firstName} ${user.lastName} (${user.email})`, status: user.status, siteIds: sitesByUser.get(user.id) ?? [], departmentIds: departmentsByUser.get(user.id) ?? [] })),
      sites,
      departments,
    };
  }

  async replaceUserMemberships(input: { organizationId: string; userId: string; siteIds: string[]; departmentIds: string[]; assignedByUserId: string; reason: string; occurredAt: Date }) {
    return db.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { organizationId: input.organizationId, id: input.userId }, select: { id: true } });
      if (!user) throw new Error("Access denied");
      const [sites, departments] = await Promise.all([
        tx.site.findMany({ where: { organizationId: input.organizationId, id: { in: input.siteIds }, active: true }, select: { id: true } }),
        tx.department.findMany({ where: { organizationId: input.organizationId, id: { in: input.departmentIds }, active: true }, select: { id: true, siteId: true } }),
      ]);
      if (sites.length !== input.siteIds.length || departments.length !== input.departmentIds.length) throw new MembershipValidationError("Every membership target must be active and tenant-scoped");
      const siteSet = new Set(input.siteIds);
      for (const department of departments) if (department.siteId && !siteSet.has(department.siteId)) throw new MembershipValidationError("A department membership requires membership in its parent site");

      const priorSites = await tx.$queryRaw<Array<{ siteId: string }>>(Prisma.sql`SELECT "siteId" FROM "UserSiteMembership" WHERE "organizationId" = ${input.organizationId}::uuid AND "userId" = ${input.userId}::uuid ORDER BY "siteId"`);
      const priorDepartments = await tx.$queryRaw<Array<{ departmentId: string }>>(Prisma.sql`SELECT "departmentId" FROM "UserDepartmentMembership" WHERE "organizationId" = ${input.organizationId}::uuid AND "userId" = ${input.userId}::uuid ORDER BY "departmentId"`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM "UserDepartmentMembership" WHERE "organizationId" = ${input.organizationId}::uuid AND "userId" = ${input.userId}::uuid`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM "UserSiteMembership" WHERE "organizationId" = ${input.organizationId}::uuid AND "userId" = ${input.userId}::uuid`);
      for (const siteId of input.siteIds) await tx.$executeRaw(Prisma.sql`INSERT INTO "UserSiteMembership" ("organizationId", "userId", "siteId", "assignedAt", "assignedByUserId") VALUES (${input.organizationId}::uuid, ${input.userId}::uuid, ${siteId}::uuid, ${input.occurredAt}, ${input.assignedByUserId}::uuid)`);
      for (const departmentId of input.departmentIds) await tx.$executeRaw(Prisma.sql`INSERT INTO "UserDepartmentMembership" ("organizationId", "userId", "departmentId", "assignedAt", "assignedByUserId") VALUES (${input.organizationId}::uuid, ${input.userId}::uuid, ${departmentId}::uuid, ${input.occurredAt}, ${input.assignedByUserId}::uuid)`);
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.assignedByUserId, action: "REPLACE_USER_ORGANIZATIONAL_MEMBERSHIPS", entityType: "User", entityId: input.userId, occurredAt: input.occurredAt, reason: input.reason, metadata: { priorSiteIds: priorSites.map((row) => row.siteId), priorDepartmentIds: priorDepartments.map((row) => row.departmentId), siteIds: input.siteIds, departmentIds: input.departmentIds } as Prisma.InputJsonValue } });
      return { siteCount: input.siteIds.length, departmentCount: input.departmentIds.length };
    });
  }
}
