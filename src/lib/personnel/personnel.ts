import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";

export interface EmployeeRecord {
  id: string;
  organizationId: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  hireDate: Date | null;
  terminationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDescriptionRecord {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  summary: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeJobAssignmentRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  jobDescriptionId: string;
  siteId: string | null;
  departmentId: string | null;
  isPrimary: boolean;
  assignedAt: Date;
  endedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
}

export interface PersonnelStore {
  listEmployees(organizationId: string): Promise<EmployeeRecord[]>;
  createEmployee(input: {
    organizationId: string;
    userId: string | null;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    hireDate: Date | null;
    actorUserId: string;
  }): Promise<EmployeeRecord>;
  transitionEmployee(input: {
    organizationId: string;
    employeeId: string;
    targetStatus: EmployeeStatus;
    effectiveDate: Date | null;
    reason: string;
    actorUserId: string;
  }): Promise<EmployeeRecord>;
  listJobDescriptions(organizationId: string): Promise<JobDescriptionRecord[]>;
  createJobDescription(input: {
    organizationId: string;
    code: string;
    title: string;
    summary: string | null;
    actorUserId: string;
  }): Promise<JobDescriptionRecord>;
  listAssignments(organizationId: string, employeeId?: string): Promise<EmployeeJobAssignmentRecord[]>;
  createAssignment(input: {
    organizationId: string;
    employeeId: string;
    jobDescriptionId: string;
    siteId: string | null;
    departmentId: string | null;
    isPrimary: boolean;
    assignedAt: Date;
    actorUserId: string;
  }): Promise<EmployeeJobAssignmentRecord>;
  endAssignment(input: {
    organizationId: string;
    assignmentId: string;
    endedAt: Date;
    reason: string;
    actorUserId: string;
  }): Promise<EmployeeJobAssignmentRecord>;
}

export class PersonnelService {
  constructor(private readonly store: PersonnelStore) {}

  listEmployees(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "personnel.read" });
    return this.store.listEmployees(organizationId);
  }

  async createEmployee(context: AuthorizationContext, input: {
    organizationId: string;
    userId?: string | null;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    hireDate?: Date | null;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    const employeeNumber = input.employeeNumber.trim().toUpperCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    if (!employeeNumber || !firstName || !lastName) throw new PersonnelValidationError("Employee number, first name, and last name are required");
    if (employeeNumber.length > 80 || firstName.length > 120 || lastName.length > 120) throw new PersonnelValidationError("Personnel identity field is too long");
    return this.store.createEmployee({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      employeeNumber,
      firstName,
      lastName,
      hireDate: input.hireDate ?? null,
      actorUserId: context.userId,
    });
  }

  async transitionEmployee(context: AuthorizationContext, input: {
    organizationId: string;
    employeeId: string;
    targetStatus: EmployeeStatus;
    effectiveDate?: Date | null;
    reason: string;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    const reason = input.reason.trim();
    if (!reason || reason.length > 1000) throw new PersonnelValidationError("A controlled personnel status reason is required");
    const effectiveDate = input.effectiveDate ?? null;
    if (effectiveDate && Number.isNaN(effectiveDate.getTime())) throw new PersonnelValidationError("Personnel status effective date is invalid");
    if (input.targetStatus === "TERMINATED" && !effectiveDate) throw new PersonnelValidationError("Termination date is required");
    return this.store.transitionEmployee({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      targetStatus: input.targetStatus,
      effectiveDate,
      reason,
      actorUserId: context.userId,
    });
  }

  listJobDescriptions(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, { organizationId, permission: "personnel.read" });
    return this.store.listJobDescriptions(organizationId);
  }

  async createJobDescription(context: AuthorizationContext, input: {
    organizationId: string;
    code: string;
    title: string;
    summary?: string | null;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    const code = input.code.trim().toUpperCase();
    const title = input.title.trim();
    const summary = input.summary?.trim() || null;
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) throw new PersonnelValidationError("Job description code is invalid");
    if (!title || title.length > 200 || (summary?.length ?? 0) > 2000) throw new PersonnelValidationError("Job description title or summary is invalid");
    return this.store.createJobDescription({ organizationId: input.organizationId, code, title, summary, actorUserId: context.userId });
  }

  listAssignments(context: AuthorizationContext, organizationId: string, employeeId?: string) {
    requireAuthorization(context, { organizationId, permission: "personnel.read" });
    return this.store.listAssignments(organizationId, employeeId);
  }

  async createAssignment(context: AuthorizationContext, input: {
    organizationId: string;
    employeeId: string;
    jobDescriptionId: string;
    siteId?: string | null;
    departmentId?: string | null;
    isPrimary?: boolean;
    assignedAt: Date;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    if (Number.isNaN(input.assignedAt.getTime())) throw new PersonnelValidationError("Assignment date is invalid");
    return this.store.createAssignment({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      jobDescriptionId: input.jobDescriptionId,
      siteId: input.siteId ?? null,
      departmentId: input.departmentId ?? null,
      isPrimary: input.isPrimary ?? false,
      assignedAt: input.assignedAt,
      actorUserId: context.userId,
    });
  }

  async endAssignment(context: AuthorizationContext, input: {
    organizationId: string;
    assignmentId: string;
    endedAt: Date;
    reason: string;
  }) {
    requireAuthorization(context, { organizationId: input.organizationId, permission: "personnel.manage" });
    if (Number.isNaN(input.endedAt.getTime())) throw new PersonnelValidationError("Assignment end date is invalid");
    const reason = input.reason.trim();
    if (!reason || reason.length > 1000) throw new PersonnelValidationError("A controlled assignment end reason is required");
    return this.store.endAssignment({
      organizationId: input.organizationId,
      assignmentId: input.assignmentId,
      endedAt: input.endedAt,
      reason,
      actorUserId: context.userId,
    });
  }
}

export class PersonnelValidationError extends Error {}
export class PersonnelEligibilityError extends Error {}
