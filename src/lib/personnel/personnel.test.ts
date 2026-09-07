import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { PersonnelService, PersonnelValidationError, type EmployeeJobAssignmentRecord, type EmployeeRecord, type JobDescriptionRecord, type PersonnelStore } from "./personnel";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function context(permission: string): AuthorizationContext {
  return { userId, organizationId, userState: "ACTIVE", grants: [{ permission, scopeType: "ORGANIZATION", scopeId: null }] };
}

const employee: EmployeeRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  organizationId,
  userId: null,
  employeeNumber: "EMP-001",
  firstName: "Synthetic",
  lastName: "Employee",
  status: "ACTIVE",
  hireDate: new Date("2026-01-01T00:00:00Z"),
  terminationDate: null,
  createdAt: new Date("2026-09-07T00:00:00Z"),
  updatedAt: new Date("2026-09-07T00:00:00Z"),
};

const job: JobDescriptionRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId,
  code: "LAB_TECH",
  title: "Laboratory Technician",
  summary: null,
  active: true,
  createdAt: new Date("2026-09-07T00:00:00Z"),
  updatedAt: new Date("2026-09-07T00:00:00Z"),
};

const assignment: EmployeeJobAssignmentRecord = {
  id: "55555555-5555-4555-8555-555555555555",
  organizationId,
  employeeId: employee.id,
  jobDescriptionId: job.id,
  siteId: null,
  departmentId: null,
  isPrimary: true,
  assignedAt: new Date("2026-01-01T00:00:00Z"),
  endedAt: null,
  createdByUserId: userId,
  createdAt: new Date("2026-09-07T00:00:00Z"),
};

function store(): PersonnelStore {
  return {
    async listEmployees() { return [employee]; },
    async createEmployee(input) { return { ...employee, userId: input.userId, employeeNumber: input.employeeNumber, firstName: input.firstName, lastName: input.lastName, hireDate: input.hireDate }; },
    async transitionEmployee(input) { return { ...employee, status: input.targetStatus, terminationDate: input.targetStatus === "TERMINATED" ? input.effectiveDate : null }; },
    async listJobDescriptions() { return [job]; },
    async createJobDescription(input) { return { ...job, code: input.code, title: input.title, summary: input.summary }; },
    async listAssignments() { return [assignment]; },
    async createAssignment(input) { return { ...assignment, employeeId: input.employeeId, jobDescriptionId: input.jobDescriptionId, siteId: input.siteId, departmentId: input.departmentId, isPrimary: input.isPrimary, assignedAt: input.assignedAt, createdByUserId: input.actorUserId }; },
    async endAssignment(input) { return { ...assignment, endedAt: input.endedAt }; },
  };
}

describe("personnel service", () => {
  it("requires personnel.read for personnel listings", async () => {
    const service = new PersonnelService(store());
    expect(() => service.listEmployees({ ...context("personnel.read"), grants: [] }, organizationId)).toThrow("Access denied");
    await expect(service.listJobDescriptions(context("personnel.read"), organizationId)).resolves.toHaveLength(1);
  });

  it("requires personnel.manage for personnel mutations", async () => {
    const service = new PersonnelService(store());
    await expect(service.createEmployee(context("personnel.read"), { organizationId, employeeNumber: "EMP-2", firstName: "Test", lastName: "Person" })).rejects.toThrow("Access denied");
    await expect(service.createJobDescription(context("personnel.read"), { organizationId, code: "TECH", title: "Technician" })).rejects.toThrow("Access denied");
    await expect(service.transitionEmployee(context("personnel.read"), { organizationId, employeeId: employee.id, targetStatus: "INACTIVE", reason: "Leave" })).rejects.toThrow("Access denied");
    await expect(service.endAssignment(context("personnel.read"), { organizationId, assignmentId: assignment.id, endedAt: new Date("2026-09-01T00:00:00Z"), reason: "Role change" })).rejects.toThrow("Access denied");
  });

  it("normalizes employee identity and job description codes", async () => {
    const service = new PersonnelService(store());
    const createdEmployee = await service.createEmployee(context("personnel.manage"), { organizationId, employeeNumber: " emp-002 ", firstName: " Test ", lastName: " Person " });
    expect(createdEmployee.employeeNumber).toBe("EMP-002");
    expect(createdEmployee.firstName).toBe("Test");
    const createdJob = await service.createJobDescription(context("personnel.manage"), { organizationId, code: " lab_tech ", title: " Laboratory Technician " });
    expect(createdJob.code).toBe("LAB_TECH");
    expect(createdJob.title).toBe("Laboratory Technician");
  });

  it("rejects invalid job codes and lifecycle inputs", async () => {
    const service = new PersonnelService(store());
    await expect(service.createJobDescription(context("personnel.manage"), { organizationId, code: "bad code", title: "Technician" })).rejects.toBeInstanceOf(PersonnelValidationError);
    await expect(service.createAssignment(context("personnel.manage"), { organizationId, employeeId: employee.id, jobDescriptionId: job.id, assignedAt: new Date("invalid") })).rejects.toBeInstanceOf(PersonnelValidationError);
    await expect(service.transitionEmployee(context("personnel.manage"), { organizationId, employeeId: employee.id, targetStatus: "TERMINATED", reason: "Employment ended" })).rejects.toBeInstanceOf(PersonnelValidationError);
    await expect(service.endAssignment(context("personnel.manage"), { organizationId, assignmentId: assignment.id, endedAt: new Date("invalid"), reason: "Role change" })).rejects.toBeInstanceOf(PersonnelValidationError);
    await expect(service.endAssignment(context("personnel.manage"), { organizationId, assignmentId: assignment.id, endedAt: new Date("2026-09-01T00:00:00Z"), reason: "   " })).rejects.toBeInstanceOf(PersonnelValidationError);
  });

  it("creates historical job assignments under personnel.manage", async () => {
    const service = new PersonnelService(store());
    const result = await service.createAssignment(context("personnel.manage"), { organizationId, employeeId: employee.id, jobDescriptionId: job.id, isPrimary: true, assignedAt: new Date("2026-01-01T00:00:00Z") });
    expect(result.isPrimary).toBe(true);
    expect(result.employeeId).toBe(employee.id);
  });

  it("supports governed status transitions and assignment ending", async () => {
    const service = new PersonnelService(store());
    const terminated = await service.transitionEmployee(context("personnel.manage"), {
      organizationId,
      employeeId: employee.id,
      targetStatus: "TERMINATED",
      effectiveDate: new Date("2026-09-01T00:00:00Z"),
      reason: "Employment ended",
    });
    expect(terminated.status).toBe("TERMINATED");
    expect(terminated.terminationDate?.toISOString()).toBe("2026-09-01T00:00:00.000Z");

    const ended = await service.endAssignment(context("personnel.manage"), {
      organizationId,
      assignmentId: assignment.id,
      endedAt: new Date("2026-09-01T00:00:00Z"),
      reason: "Role changed",
    });
    expect(ended.endedAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
