import { describe, expect, it } from "vitest";
import { OrganizationalAudienceDistributionService, OrganizationalAudienceValidationError, type OrganizationalAudienceStore } from "./organizational-audience";

const context = { organizationId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", permissions: new Set(["document.distribute"]) };

function store(): OrganizationalAudienceStore {
  return {
    async listOptions() { return { sites: [], departments: [], documents: [] }; },
    async assignAudience(input) { return { created: 2, skippedExisting: 1, recipientUserIds: [input.audienceId] }; },
  };
}

describe("OrganizationalAudienceDistributionService", () => {
  it("binds tenant and actor to authorized distribution context", async () => {
    let captured: unknown;
    const custom: OrganizationalAudienceStore = {
      ...store(),
      async assignAudience(input) { captured = input; return { created: 1, skippedExisting: 0, recipientUserIds: [input.audienceId] }; },
    };
    const service = new OrganizationalAudienceDistributionService(custom, () => new Date("2026-09-06T20:00:00Z"));
    await service.assign(context, { organizationId: context.organizationId, audienceType: "SITE", audienceId: "33333333-3333-4333-8333-333333333333", versionId: "44444444-4444-4444-8444-444444444444", dueAt: new Date("2026-09-08T20:00:00Z") });
    expect(captured).toMatchObject({ organizationId: context.organizationId, assignedByUserId: context.userId, audienceType: "SITE" });
  });

  it("rejects due dates that are not in the future", async () => {
    const service = new OrganizationalAudienceDistributionService(store(), () => new Date("2026-09-06T20:00:00Z"));
    await expect(service.assign(context, { organizationId: context.organizationId, audienceType: "DEPARTMENT", audienceId: "33333333-3333-4333-8333-333333333333", versionId: "44444444-4444-4444-8444-444444444444", dueAt: new Date("2026-09-06T19:00:00Z") })).rejects.toBeInstanceOf(OrganizationalAudienceValidationError);
  });

  it("requires document distribution authorization", async () => {
    const service = new OrganizationalAudienceDistributionService(store());
    await expect(service.listOptions({ ...context, permissions: new Set() }, context.organizationId)).rejects.toThrow("Access denied");
  });
});
