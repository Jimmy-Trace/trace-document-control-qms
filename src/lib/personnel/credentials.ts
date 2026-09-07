import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { PersonnelValidationError } from "./personnel";

export interface EmployeeCredentialRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  credentialType: string;
  credentialNumber: string | null;
  issuingAuthority: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  fileId: string | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface PersonnelCredentialStore {
  listCredentials(organizationId: string, employeeId?: string): Promise<EmployeeCredentialRecord[]>;
  createCredential(input: {
    organizationId: string;
    employeeId: string;
    credentialType: string;
    credentialNumber: string | null;
    issuingAuthority: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    fileId: string | null;
    actorUserId: string;
  }): Promise<EmployeeCredentialRecord>;
}

export class PersonnelCredentialService {
  constructor(private readonly store: PersonnelCredentialStore) {}

  listCredentials(context: AuthorizationContext, organizationId: string, employeeId?: string) {
    requireAuthorization(context, { organizationId, permission: "personnel.read" });
    return this.store.listCredentials(organizationId, employeeId);
  }

  createCredential(context: AuthorizationContext, input: {
    organizationId: string;
    employeeId: string;
    credentialType: string;
    credentialNumber?: string | null;
    issuingAuthority?: string | null;
    issuedAt?: Date | null;
    expiresAt?: Date | null;
    fileId?: string | null;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    const credentialType = input.credentialType.trim();
    const credentialNumber = input.credentialNumber?.trim() || null;
    const issuingAuthority = input.issuingAuthority?.trim() || null;
    const issuedAt = input.issuedAt ?? null;
    const expiresAt = input.expiresAt ?? null;
    if (!credentialType || credentialType.length > 160) throw new PersonnelValidationError("Credential type is required");
    if ((credentialNumber?.length ?? 0) > 160 || (issuingAuthority?.length ?? 0) > 240) throw new PersonnelValidationError("Credential detail is too long");
    if (issuedAt && Number.isNaN(issuedAt.getTime())) throw new PersonnelValidationError("Credential issue date is invalid");
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new PersonnelValidationError("Credential expiration date is invalid");
    if (issuedAt && expiresAt && expiresAt < issuedAt) throw new PersonnelValidationError("Credential expiration cannot precede issue date");
    return this.store.createCredential({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      credentialType,
      credentialNumber,
      issuingAuthority,
      issuedAt,
      expiresAt,
      fileId: input.fileId ?? null,
      actorUserId: context.userId,
    });
  }
}
