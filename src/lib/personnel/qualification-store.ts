import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { EmployeeQualificationRecord, PersonnelQualificationStore } from "./qualifications";
import { PersonnelEligibilityError, PersonnelValidationError } from "./personnel";

export class PrismaPersonnelQualificationStore implements PersonnelQualificationStore {
  async listQualifications(organizationId: string, employeeId?: string): Promise<EmployeeQualificationRecord[]> {
    return db.$queryRaw<EmployeeQualificationRecord[]>(employeeId ? Prisma.sql`
      SELECT * FROM "EmployeeQualification"
      WHERE "organizationId" = ${organizationId}::uuid AND "employeeId" = ${employeeId}::uuid
      ORDER BY "qualifiedAt" DESC, "createdAt" DESC
    ` : Prisma.sql`
      SELECT * FROM "EmployeeQualification"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "qualifiedAt" DESC, "createdAt" DESC
    `);
  }

  async createQualification(input: {
    organizationId: string;
    employeeId: string;
    qualificationType: string;
    qualificationScope: string | null;
    qualifiedAt: Date;
    expiresAt: Date | null;
    fileId: string | null;
    actorUserId: string;
  }): Promise<EmployeeQualificationRecord> {
    return db.$transaction(async (tx) => {
      const employees = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
        SELECT "id", "status"::text AS "status" FROM "Employee"
        WHERE "organizationId" = ${input.organizationId}::uuid AND "id" = ${input.employeeId}::uuid
      `);
      const employee = employees[0];
      if (!employee) throw new Error("Access denied");
      if (employee.status === "TERMINATED") throw new PersonnelEligibilityError("Qualifications cannot be added to a terminated employee");

      if (input.fileId) {
        const file = await tx.fileObject.findFirst({
          where: { organizationId: input.organizationId, id: input.fileId },
          select: { id: true, status: true, sha256: true },
        });
        if (!file) throw new Error("Access denied");
        if (file.status !== "AVAILABLE") throw new PersonnelEligibilityError("Qualification evidence file must be AVAILABLE");
      }

      const rows = await tx.$queryRaw<EmployeeQualificationRecord[]>(Prisma.sql`
        INSERT INTO "EmployeeQualification" (
          "organizationId", "employeeId", "qualificationType", "qualificationScope",
          "qualifiedAt", "expiresAt", "fileId", "createdByUserId"
        ) VALUES (
          ${input.organizationId}::uuid, ${input.employeeId}::uuid, ${input.qualificationType}, ${input.qualificationScope},
          ${input.qualifiedAt}, ${input.expiresAt}, ${input.fileId}::uuid, ${input.actorUserId}::uuid
        ) RETURNING *
      `);
      const qualification = rows[0];
      if (!qualification) throw new PersonnelValidationError("Qualification could not be created");

      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "EMPLOYEE_QUALIFICATION_CREATED",
        entityType: "EmployeeQualification",
        entityId: qualification.id,
        metadata: {
          employeeId: qualification.employeeId,
          qualificationType: qualification.qualificationType,
          qualificationScope: qualification.qualificationScope,
          qualifiedAt: qualification.qualifiedAt.toISOString(),
          expiresAt: qualification.expiresAt?.toISOString() ?? null,
          fileId: qualification.fileId,
        },
      }});
      return qualification;
    });
  }
}
