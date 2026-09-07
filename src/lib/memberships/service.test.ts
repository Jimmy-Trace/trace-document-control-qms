import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { MembershipService, type MembershipStore } from "./service";

const admin: AuthorizationContext = { userId: "admin-1", organizationId: "org-1", userState: "ACTIVE", grants: [{ permission: "administration.manage", scopeType: "ORGANIZATION", scopeId: null }] };
const ordinary: AuthorizationContext = { userId: "user-1", organizationId: "org-1", userState: "ACTIVE", grants: [] };

function fixture() {
  const writes: unknown[] = [];
  const store: MembershipStore = {
    async listOptions() { return { users: [], sites: [], departments: [] }; },
    async replaceUserMemberships(input) { writes.push(input); return { siteCount: input.siteIds.length, departmentCount: input.departmentIds.length }; },
  };
  return { store, writes };
}

describe("organizational memberships", () => {
  it("requires administration access to list or replace memberships", async () => {
    const service = new MembershipService(fixture().store);
    await expect(service.list(ordinary)).rejects.toThrow("Access denied");
    await expect(service.replace(ordinary, { userId: "u1", siteIds: [], departmentIds: [], reason: "controlled change" })).rejects.toThrow("Access denied");
  });

  it("passes tenant and actor identity from authorization context", async () => {
    const f = fixture();
    const service = new MembershipService(f.store, () => new Date("2026-09-06T23:00:00Z"));
    await expect(service.replace(admin, { userId: "u1", siteIds: ["s1"], departmentIds: ["d1"], reason: "Assign primary work area" })).resolves.toEqual({ siteCount: 1, departmentCount: 1 });
    expect(f.writes).toEqual([expect.objectContaining({ organizationId: "org-1", assignedByUserId: "admin-1", userId: "u1", siteIds: ["s1"], departmentIds: ["d1"], reason: "Assign primary work area" })]);
  });

  it("rejects duplicate selections and missing controlled reason", async () => {
    const service = new MembershipService(fixture().store);
    await expect(service.replace(admin, { userId: "u1", siteIds: ["s1", "s1"], departmentIds: [], reason: "duplicate" })).rejects.toThrow("unique");
    await expect(service.replace(admin, { userId: "u1", siteIds: [], departmentIds: [], reason: "   " })).rejects.toThrow("reason");
  });
});
