import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { ControlledCopyConflictError, ControlledCopyService, ControlledCopyValidationError, type ControlledCopyRecord, type ControlledCopyStore } from "./controlled-copies";

const distributor: AuthorizationContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  userState: "ACTIVE",
  grants: [{ permission: "document.distribute", scopeType: "ORGANIZATION", scopeId: null }],
};

function record(status: ControlledCopyRecord["status"] = "ISSUED"): ControlledCopyRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: distributor.organizationId,
    documentVersionId: "44444444-4444-4444-8444-444444444444",
    copyNumber: 1,
    recipientName: "Main Lab",
    location: "Accessioning",
    purpose: "Bench reference",
    status,
    issuedAt: new Date("2026-09-07T00:00:00Z"),
    recallRequestedAt: null,
    closedAt: null,
    closureReason: null,
  };
}

function store(): ControlledCopyStore {
  return {
    async issue(input) { return { ...record(), organizationId: input.organizationId, documentVersionId: input.documentVersionId, recipientName: input.recipientName, location: input.location, purpose: input.purpose, issuedAt: input.issuedAt }; },
    async transition(input) { return input.reason === "conflict" ? null : { ...record(input.action === "RECALL" ? "RECALL_REQUESTED" : input.action === "RETURN" ? "RETURNED" : "DESTROYED") }; },
    async list() { return [record()]; },
  };
}

describe("controlled copy service", () => {
  it("requires document.distribute", async () => {
    const service = new ControlledCopyService(store());
    await expect(service.list({ ...distributor, grants: [] }, distributor.organizationId)).rejects.toThrow("Access denied");
  });

  it("normalizes issuance evidence", async () => {
    const service = new ControlledCopyService(store(), () => new Date("2026-09-07T00:00:00Z"));
    const result = await service.issue(distributor, {
      organizationId: distributor.organizationId,
      documentVersionId: "44444444-4444-4444-8444-444444444444",
      recipientName: " Main Lab ",
      location: " Accessioning ",
      purpose: " Bench reference ",
    });
    expect(result.recipientName).toBe("Main Lab");
    expect(result.location).toBe("Accessioning");
    expect(result.purpose).toBe("Bench reference");
  });

  it("rejects blank recipient or purpose", async () => {
    const service = new ControlledCopyService(store());
    await expect(service.issue(distributor, { organizationId: distributor.organizationId, documentVersionId: "44444444-4444-4444-8444-444444444444", recipientName: " ", purpose: "Use" })).rejects.toBeInstanceOf(ControlledCopyValidationError);
  });

  it("requires a reason for lifecycle transitions", async () => {
    const service = new ControlledCopyService(store());
    await expect(service.transition(distributor, { organizationId: distributor.organizationId, copyId: "33333333-3333-4333-8333-333333333333", action: "RECALL", reason: " " })).rejects.toBeInstanceOf(ControlledCopyValidationError);
  });

  it("surfaces stale copy state as a conflict", async () => {
    const service = new ControlledCopyService(store());
    await expect(service.transition(distributor, { organizationId: distributor.organizationId, copyId: "33333333-3333-4333-8333-333333333333", action: "RETURN", reason: "conflict" })).rejects.toBeInstanceOf(ControlledCopyConflictError);
  });
});
