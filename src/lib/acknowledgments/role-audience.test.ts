import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { RoleAudienceDistributionService, type RoleAudienceStore } from "./role-audience";

const distributor: AuthorizationContext = {
  userId: "admin-1",
  organizationId: "org-1",
  userState: "ACTIVE",
  grants: [{ permission: "document.distribute", scopeType: "ORGANIZATION", scopeId: null }],
};

function store(): RoleAudienceStore {
  return {
    async listOptions() {
      return { roles: [{ id: "role-1", name: "Laboratory Staff", memberCount: 3 }], documents: [] };
    },
    async assignRole() {
      return { created: 2, skippedExisting: 1, recipientUserIds: ["u1", "u2", "u3"] };
    },
  };
}

describe("role acknowledgment audience", () => {
  it("requires distribution authorization", async () => {
    const service = new RoleAudienceDistributionService(store());
    await expect(service.listOptions({ ...distributor, grants: [] }, "org-1")).rejects.toThrow("Access denied");
  });

  it("rejects past due dates", async () => {
    const service = new RoleAudienceDistributionService(store(), () => new Date("2026-09-06T16:00:00Z"));
    await expect(service.assign(distributor, { organizationId: "org-1", roleId: "role-1", versionId: "v-1", dueAt: new Date("2026-09-06T15:00:00Z") })).rejects.toThrow("future");
  });

  it("returns created and already-assigned counts", async () => {
    const service = new RoleAudienceDistributionService(store(), () => new Date("2026-09-06T16:00:00Z"));
    await expect(service.assign(distributor, { organizationId: "org-1", roleId: "role-1", versionId: "v-1", dueAt: new Date("2026-09-10T00:00:00Z") })).resolves.toEqual({ created: 2, skippedExisting: 1, recipientUserIds: ["u1", "u2", "u3"] });
  });
});
