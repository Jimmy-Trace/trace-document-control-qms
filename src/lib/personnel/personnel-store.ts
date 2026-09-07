import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { EmployeeJobAssignmentRecord, EmployeeRecord, JobDescriptionRecord, PersonnelStore } from "./personnel";
import { PersonnelEligibilityError, PersonnelValidationError } from "./personnel";

export class PrismaPersonnelStore implements PersonnelStore {
  async listEmployees(organizationId: string): Promise<EmployeeRecord[]> {
    return db.$queryRaw<EmployeeRecord[]>(Prisma.sql`
      SELECT * FROM "Employee"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "lastName", "firstName", "employeeNumber"
    `);
  }

  async createEmployee(input: { organizationId: string; userId: string | null; employeeNumber: string; firstName: string; lastName: string; hireDate: Date | null; actorUserId: string }): Promise<EmployeeRecord> {
    return db.$transaction(async (tx) => {
      if (input.userId) {
        const user = await tx.user.findFirst({ where: { organizationId: input.organizationId, id: input.userId }, select: { id: true } });
        if (!user) throw new Error("Access denied");
        const linked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Employee"
          WHERE "organizationId" = ${input.organizationId}::uuid AND "userId" = ${input.userId}::uuid
        `);
        if (linked.length) throw new PersonnelValidationError("This user account is already linked to an employee record");
      }
      const duplicate = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Employee"
        WHERE "organizationId" = ${input.organizationId}::uuid AND "employeeNumber" = ${input.employeeNumber}
      `);
      if (duplicate.length) throw new PersonnelValidationError("Employee number already exists");
      const rows = await tx.$queryRaw<EmployeeRecord[]>(Prisma.sql`
        INSERT INTO "Employee" ("organizationId", "userId", "employeeNumber", "firstName", "lastName", "hireDate")
        VALUES (${input.organizationId}::uuid, ${input.userId}::uuid, ${input.employeeNumber}, ${input.firstName}, ${input.lastName}, ${input.hireDate})
        RETURNING *
      `);
      const employee = rows[0]!;
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: employee.id,
        entityVersion: employee.employeeNumber,
        metadata: { employeeNumber: employee.employeeNumber, userId: employee.userId, status: employee.status, hireDate: employee.hireDate?.toISOString() ?? null },
      }});
      return employee;
    });
  }

  async listJobDescriptions(organizationId: string): Promise<JobDescriptionRecord[]> {
    return db.$queryRaw<JobDescriptionRecord[]>(Prisma.sql`
      SELECT * FROM "JobDescription"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "code"
    `);
  }

  async createJobDescription(input: { organizationId: string; code: string; title: string; summary: string | null; actorUserId: string }): Promise<JobDescriptionRecord> {
    return db.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "JobDescription"
        WHERE "organizationId" = ${input.organizationId}::uuid AND "code" = ${input.code}
      `);
      if (duplicate.length) throw new PersonnelValidationError("Job description code already exists");
      const rows = await tx.$queryRaw<JobDescriptionRecord[]>(Prisma.sql`
        INSERT INTO "JobDescription" ("organizationId", "code", "title", "summary")
        VALUES (${input.organizationId}::uuid, ${input.code}, ${input.title}, ${input.summary})
        RETURNING *
      `);
      const job = rows[0]!;
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "JOB_DESCRIPTION_CREATED",
        entityType: "JobDescription",
        entityId: job.id,
        entityVersion: job.code,
        metadata: { code: job.code, title: job.title, active: job.active },
      }});
      return job;
    });
  }

  async listAssignments(organizationId: string, employeeId?: string): Promise<EmployeeJobAssignmentRecord[]> {
    return db.$queryRaw<EmployeeJobAssignmentRecord[]>(employeeId ? Prisma.sql`
      SELECT * FROM "EmployeeJobAssignment"
      WHERE "organizationId" = ${organizationId}::uuid AND "employeeId" = ${employeeId}::uuid
      ORDER BY "assignedAt" DESC, "createdAt" DESC
    ` : Prisma.sql`
      SELECT * FROM "EmployeeJobAssignment"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "assignedAt" DESC, "createdAt" DESC
    `);
  }

  async createAssignment(input: { organizationId: string; employeeId: string; jobDescriptionId: string; siteId: string | null; departmentId: string | null; isPrimary: boolean; assignedAt: Date; actorUserId: string }): Promise<EmployeeJobAssignmentRecord> {
    return db.$transaction(async (tx) => {
      const [employee, jobs] = await Promise.all([
        tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
          SELECT "id", "status"::text AS "status" FROM "Employee"
          WHERE "organizationId" = ${input.organizationId}::uuid AND "id" = ${input.employeeId}::uuid
        `),
        tx.$queryRaw<Array<{ id: string; active: boolean }>>(Prisma.sql`
          SELECT "id", "active" FROM "JobDescription"
          WHERE "organizationId" = ${input.organizationId}::uuid AND "id" = ${input.jobDescriptionId}::uuid
        `),
      ]);
      if (!employee[0] || !jobs[0]) throw new Error("Access denied");
      if (employee[0].status !== "ACTIVE") throw new PersonnelEligibilityError("Only active employees can receive new job assignments");
      if (!jobs[0].active) throw new PersonnelEligibilityError("Inactive job descriptions cannot receive new assignments");

      if (input.siteId) {
        const site = await tx.site.findFirst({ where: { organizationId: input.organizationId, id: input.siteId, active: true }, select: { id: true } });
        if (!site) throw new Error("Access denied");
      }
      if (input.departmentId) {
        const department = await tx.department.findFirst({ where: { organizationId: input.organizationId, id: input.departmentId, active: true }, select: { id: true, siteId: true } });
        if (!department) throw new Error("Access denied");
        if (input.siteId && department.siteId && department.siteId !== input.siteId) throw new PersonnelValidationError("Department does not belong to the selected site");
      }
      if (input.isPrimary) {
        const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "EmployeeJobAssignment"
          WHERE "organizationId" = ${input.organizationId}::uuid
            AND "employeeId" = ${input.employeeId}::uuid
            AND "isPrimary" = true
            AND "endedAt" IS NULL
        `);
        if (existing.length) throw new PersonnelEligibilityError("Employee already has an active primary job assignment");
      }

      const rows = await tx.$queryRaw<EmployeeJobAssignmentRecord[]>(Prisma.sql`
        INSERT INTO "EmployeeJobAssignment" (
          "organizationId", "employeeId", "jobDescriptionId", "siteId", "departmentId", "isPrimary", "assignedAt", "createdByUserId"
        ) VALUES (
          ${input.organizationId}::uuid, ${input.employeeId}::uuid, ${input.jobDescriptionId}::uuid,
          ${input.siteId}::uuid, ${input.departmentId}::uuid, ${input.isPrimary}, ${input.assignedAt}, ${input.actorUserId}::uuid
        ) RETURNING *
      `);
      const assignment = rows[0]!;
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "EMPLOYEE_JOB_ASSIGNED",
        entityType: "EmployeeJobAssignment",
        entityId: assignment.id,
        metadata: {
          employeeId: assignment.employeeId,
          jobDescriptionId: assignment.jobDescriptionId,
          siteId: assignment.siteId,
          departmentId: assignment.departmentId,
          isPrimary: assignment.isPrimary,
          assignedAt: assignment.assignedAt.toISOString(),
        },
      }});
      return assignment;
    });
  }
}
