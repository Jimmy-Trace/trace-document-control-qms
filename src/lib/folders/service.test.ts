import { describe, expect, it } from "vitest";
import { FolderHierarchyService, FolderValidationError, type FolderStore } from "./service";
import type { AuthorizationContext } from "../security/authorization";

const context: AuthorizationContext = {
  userId: "22222222-2222-4222-8222-222222222222",
  organizationId: "11111111-1111-4111-8111-111111111111",
  userState: "ACTIVE",
  grants: [
    { permission: "document.read", scopeType: "ORGANIZATION", scopeId: null },
    { permission: "document.create", scopeType: "ORGANIZATION", scopeId: null },
  ],
};

function store(): FolderStore {
  return {
    async list() { return { folders: [], documents: [] }; },
    async createFolder() { return { id: "33333333-3333-4333-8333-333333333333" }; },
    async renameFolder() {},
    async placeDocument() {},
  };
}

describe("FolderHierarchyService", () => {
  it("binds creation to the authorized tenant and actor", async () => {
    let captured: unknown;
    const custom: FolderStore = { ...store(), async createFolder(input) { captured = input; return { id: "33333333-3333-4333-8333-333333333333" }; } };
    const service = new FolderHierarchyService(custom, () => new Date("2026-09-07T01:00:00Z"));
    await service.create(context, { organizationId: context.organizationId, parentFolderId: null, name: " Policies " });
    expect(captured).toMatchObject({ organizationId: context.organizationId, actorUserId: context.userId, name: "Policies" });
  });

  it("requires document.create for mutations", async () => {
    const service = new FolderHierarchyService(store());
    const noCreate: AuthorizationContext = { ...context, grants: [{ permission: "document.read", scopeType: "ORGANIZATION", scopeId: null }] };
    await expect(service.create(noCreate, { organizationId: context.organizationId, parentFolderId: null, name: "Policies" })).rejects.toThrow("Access denied");
  });

  it("rejects blank folder names", async () => {
    const service = new FolderHierarchyService(store());
    await expect(service.create(context, { organizationId: context.organizationId, parentFolderId: null, name: "   " })).rejects.toBeInstanceOf(FolderValidationError);
  });
});