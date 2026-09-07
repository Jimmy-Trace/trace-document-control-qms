import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { PersonnelValidationError } from "./personnel";

export interface EmployeeQualificationRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  qualificationType: string;
  qualificationScope: string | null;
  qualifiedAt: Date;
  expiresAt: Date | null;
  fileId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface PersonnelQualificationStore {
  listQualifications(organizationId: string, employeeId?: string): Promise<EmployeeQualificationRecord[]>;
  createQualification(input: {
    organizationId: string;
    employeeId: string;
    qualificationType: string;
    qualificationScope: string | null;
    qualifiedAt: Date;
    expiresAt: Date | null;
    fileId: string | null;
    actorUserId: string;
  }): Promise<EmployeeQualificationRecord>;
}

export class PersonnelQualificationService {
  constructor(private readonly store: PersonnelQualificationStore) {}

  listQualifications(context: AuthorizationContext, organizationId: string, employeeId?: string) {
    requireAuthorization(context, { organizationId, permission: "personnel.read" });
    return this.store.listQualifications(organizationId, employeeId);
  }

  createQualification(context: AuthorizationContext, input: {
    organizationId: string;
    employeeId: string;
    qualificationType: string;
    qualificationScope?: string | null;
    qualifiedAt: Date;
    expiresAt?: Date | null;
    fileId?: string | null;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    const qualificationType = input.qualificationType.trim();
    const qualificationScope = input.qualificationScope?.trim() || null;
    const qualifiedAt = input.qualifiedAt;
    const expiresAt = input.expiresAt ?? null;
    if (!qualificationType || qualificationType.length > 160) throw new PersonnelValidationError("Qualification type is required");
    if ((qualificationScope?.length ?? 0) > 500) throw new PersonnelValidationError("Qualification scope is too long");
    if (Number.isNaN(qualifiedAt.getTime())) throw new PersonnelValidationError("Qualification date is invalid");
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new PersonnelValidationError("Qualification expiration date is invalid");
    if (expiresAt && expiresAt < qualifiedAt) throw new PersonnelValidationError("Qualification expiration cannot precede qualification date");
    return this.store.createQualification({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      qualificationType,
      qualificationScope,
      qualifiedAt,
      expiresAt,
      fileId: input.fileId ?? null,
      actorUserId: context.userId,
    });
  }
}
