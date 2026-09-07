import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { PersonnelCredentialService, type EmployeeCredentialRecord, type PersonnelCredentialStore } from "./credentials";
import { PersonnelValidationError } from "./personnel";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const employeeId = "33333333-3333-4333-8333-333333333333";

function context(permission: string): AuthorizationContext {
  return { userId, organizationId, userState: "ACTIVE", grants: [{ permission, scopeType: "ORGANIZATION", scopeId: null }] };
}

const credential: EmployeeCredentialRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId,
  employeeId,
  credentialType: "Clinical Laboratory Scientist License",
  credentialNumber: "CLS-1001",
  issuingAuthority: "Synthetic Licensing Board",
  issuedAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2027-01-01T00:00:00Z"),
  fileId: null,
  createdByUserId: userId,
  createdAt: new Date("2026-09-07T00:00:00Z"),
};

function store(): PersonnelCredentialStore {
  return {
    async listCredentials() { return [credential]; },
    async createCredential(input) { return { ...credential, ...input, id: credential.id, createdByUserId: input.actorUserId, createdAt: credential.createdAt }; },
  };
}

describe("personnel credential service", () => {
  it("requires personnel.read for credential listings", () => {
    const service = new PersonnelCredentialService(store());
    expect(() => service.listCredentials({ ...context("personnel.read"), grants: [] }, organizationId)).toThrow("Access denied");
  });

  it("requires personnel.manage for credential creation", () => {
    const service = new PersonnelCredentialService(store());
    expect(() => service.createCredential(context("personnel.read"), { organizationId, employeeId, credentialType: "License" })).toThrow("Access denied");
  });

  it("normalizes credential details and preserves expiration", async () => {
    const service = new PersonnelCredentialService(store());
    const result = await service.createCredential(context("personnel.manage"), {
      organizationId,
      employeeId,
      credentialType: "  License  ",
      credentialNumber: "  ABC-123  ",
      expiresAt: new Date("2027-01-01T00:00:00Z"),
    });
    expect(result.credentialType).toBe("License");
    expect(result.credentialNumber).toBe("ABC-123");
    expect(result.expiresAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rejects invalid credential date ranges", () => {
    const service = new PersonnelCredentialService(store());
    expect(() => service.createCredential(context("personnel.manage"), {
      organizationId,
      employeeId,
      credentialType: "License",
      issuedAt: new Date("2027-01-01T00:00:00Z"),
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    })).toThrow(PersonnelValidationError);
  });
});
