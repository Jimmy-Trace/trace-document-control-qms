import { describe, expect, it } from "vitest";
import { RetentionService, RetentionValidationError, type RetentionStore } from "./service";
import type { AuthorizationContext } from "../security/authorization";

const context: AuthorizationContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  userState: "ACTIVE",
  grants: [{ permission: "administration.manage", scopeType: "ORGANIZATION", scopeId: null }],
};

function store(): RetentionStore {
  return {
    async list() { return { policies: [], holds: [] }; },
    async dispositionStatus(input) { return { entityType: input.entityType, entityId: input.entityId, state: "ELIGIBLE", activeHoldIds: [], retentionPolicyIds: [], retentionEligibleAt: null }; },
    async createPolicy() { return { id: "33333333-3333-4333-8333-333333333333" }; },
    async setPolicyActive() {},
    async createHold() { return { id: "44444444-4444-4444-8444-444444444444" }; },
    async releaseHold() {},
  };
}

describe("RetentionService", () => {
  it("requires administration.manage", async () => {
    const service = new RetentionService(store());
    await expect(service.list({ ...context, grants: [] }, context.organizationId)).rejects.toThrow("Access denied");
  });

  it("protects disposition status with administration.manage", async () => {
    const service = new RetentionService(store());
    await expect(service.dispositionStatus({ ...context, grants: [] }, { organizationId: context.organizationId, entityType: "Document", entityId: "55555555-5555-4555-8555-555555555555" })).rejects.toThrow("Access denied");
  });

  it("passes a controlled clock into disposition evaluation", async () => {
    let captured: unknown;
    const custom: RetentionStore = { ...store(), async dispositionStatus(input) { captured = input; return { entityType: input.entityType, entityId: input.entityId, state: "ELIGIBLE", activeHoldIds: [], retentionPolicyIds: [], retentionEligibleAt: null }; } };
    const service = new RetentionService(custom, () => new Date("2026-09-07T03:00:00Z"));
    await service.dispositionStatus(context, { organizationId: context.organizationId, entityType: "DocumentVersion", entityId: "55555555-5555-4555-8555-555555555555" });
    expect(captured).toMatchObject({ organizationId: context.organizationId, entityType: "DocumentVersion", now: new Date("2026-09-07T03:00:00Z") });
  });

  it("validates retention duration", async () => {
    const service = new RetentionService(store());
    await expect(service.createPolicy(context, { organizationId: context.organizationId, recordType: "FileObject", retentionDays: 0 })).rejects.toBeInstanceOf(RetentionValidationError);
  });

  it("binds hold creation to the authorized actor and tenant", async () => {
    let captured: unknown;
    const custom: RetentionStore = { ...store(), async createHold(input) { captured = input; return { id: "44444444-4444-4444-8444-444444444444" }; } };
    const service = new RetentionService(custom, () => new Date("2026-09-07T02:00:00Z"));
    await service.createHold(context, { organizationId: context.organizationId, entityType: "Document", entityId: "55555555-5555-4555-8555-555555555555", reason: " Litigation preservation " });
    expect(captured).toMatchObject({ organizationId: context.organizationId, actorUserId: context.userId, reason: "Litigation preservation" });
  });

  it("requires a release reason", async () => {
    const service = new RetentionService(store());
    await expect(service.releaseHold(context, { organizationId: context.organizationId, holdId: "44444444-4444-4444-8444-444444444444", reason: "   " })).rejects.toBeInstanceOf(RetentionValidationError);
  });
});
