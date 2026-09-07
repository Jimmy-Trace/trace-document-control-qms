import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { PersonnelQualificationService, type EmployeeQualificationRecord, type PersonnelQualificationStore } from "./qualifications";
import { PersonnelValidationError } from "./personnel";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const employeeId = "33333333-3333-4333-8333-333333333333";

function context(permission: string): AuthorizationContext {
  return { userId, organizationId, userState: "ACTIVE", grants: [{ permission, scopeType: "ORGANIZATION", scopeId: null }] };
}

const qualification: EmployeeQualificationRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId,
  employeeId,
  qualificationType: "Molecular PCR Testing",
  qualificationScope: "Respiratory panel setup, amplification, and review",
  qualifiedAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2027-01-01T00:00:00Z"),
  fileId: null,
  createdByUserId: userId,
  createdAt: new Date("2026-09-07T00:00:00Z"),
};

function store(): PersonnelQualificationStore {
  return {
    async listQualifications() { return [qualification]; },
    async createQualification(input) { return { ...qualification, ...input, id: qualification.id, createdByUserId: input.actorUserId, createdAt: qualification.createdAt }; },
  };
}

describe("personnel qualification service", () => {
  it("requires personnel.read for qualification listings", () => {
    const service = new PersonnelQualificationService(store());
    expect(() => service.listQualifications({ ...context("personnel.read"), grants: [] }, organizationId)).toThrow("Access denied");
  });

  it("requires personnel.manage for qualification creation", () => {
    const service = new PersonnelQualificationService(store());
    expect(() => service.createQualification(context("personnel.read"), {
      organizationId,
      employeeId,
      qualificationType: "PCR",
      qualifiedAt: new Date("2026-01-01T00:00:00Z"),
    })).toThrow("Access denied");
  });

  it("normalizes qualification details and preserves expiration", async () => {
    const service = new PersonnelQualificationService(store());
    const result = await service.createQualification(context("personnel.manage"), {
      organizationId,
      employeeId,
      qualificationType: "  PCR  ",
      qualificationScope: "  Respiratory panel  ",
      qualifiedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2027-01-01T00:00:00Z"),
    });
    expect(result.qualificationType).toBe("PCR");
    expect(result.qualificationScope).toBe("Respiratory panel");
    expect(result.expiresAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rejects invalid qualification date ranges", () => {
    const service = new PersonnelQualificationService(store());
    expect(() => service.createQualification(context("personnel.manage"), {
      organizationId,
      employeeId,
      qualificationType: "PCR",
      qualifiedAt: new Date("2027-01-01T00:00:00Z"),
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    })).toThrow(PersonnelValidationError);
  });
});
