import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { DocumentCommandService, type DocumentLifecycleStore, type StoredDocumentVersion } from "./service";

const version: StoredDocumentVersion = {
  id: "version-1",
  organizationId: "org-1",
  documentId: "document-1",
  status: "EFFECTIVE",
  lockVersion: 2,
};

function store(): DocumentLifecycleStore {
  return {
    async createDraft() { throw new Error("not used"); },
    async createRevision() { throw new Error("not used"); },
    async updateDraft() { throw new Error("not used"); },
    async findVersion() { return version; },
    async applyTransition() { return true; },
  };
}

function context(permission: string): AuthorizationContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    userState: "ACTIVE",
    grants: [{ permission, scopeType: "ORGANIZATION", scopeId: null }],
  };
}

describe("Prompt 044 granular document permissions", () => {
  it("does not allow document.make_effective alone to retire", async () => {
    const service = new DocumentCommandService(store());
    await expect(service.transition(context("document.make_effective"), {
      organizationId: "org-1",
      versionId: "version-1",
      command: "RETIRE",
      expectedLockVersion: 2,
      reason: "Controlled retirement",
    })).rejects.toThrow("Access denied");
  });

  it("allows retirement with document.retire", async () => {
    const service = new DocumentCommandService(store());
    await expect(service.transition(context("document.retire"), {
      organizationId: "org-1",
      versionId: "version-1",
      command: "RETIRE",
      expectedLockVersion: 2,
      reason: "Controlled retirement",
    })).resolves.toMatchObject({ status: "RETIRED", lockVersion: 3 });
  });
});
