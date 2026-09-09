import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import {
  DocumentCommandService,
  documentEffectiveWebhookEvent,
  type DocumentLifecycleStore,
  type StoredDocumentVersion,
} from "./service";

const occurredAt = new Date("2026-09-09T05:00:00Z");
const approved: StoredDocumentVersion = {
  id: "version-1",
  organizationId: "org-1",
  documentId: "document-1",
  status: "APPROVED",
  lockVersion: 7,
};
const context: AuthorizationContext = {
  userId: "user-1",
  organizationId: "org-1",
  userState: "ACTIVE",
  grants: [
    {
      permission: "document.make_effective",
      scopeType: "ORGANIZATION",
      scopeId: null,
    },
  ],
};

function store(succeeds = true): DocumentLifecycleStore {
  return {
    async createDraft() { return approved; },
    async createRevision() { return approved; },
    async updateDraft() { return true; },
    async findVersion(organizationId, versionId) {
      return organizationId === approved.organizationId && versionId === approved.id
        ? approved
        : null;
    },
    async applyTransition() { return succeeds; },
  };
}

describe("document effective webhook publication", () => {
  it("builds a deterministic metadata-only event", () => {
    expect(
      documentEffectiveWebhookEvent({
        organizationId: "org-1",
        documentId: "document-1",
        versionId: "version-1",
        occurredAt,
      }),
    ).toEqual({
      organizationId: "org-1",
      eventId: "document.effective:version-1",
      eventName: "document.effective",
      occurredAt,
      data: {
        documentId: "document-1",
        documentVersionId: "version-1",
        status: "EFFECTIVE",
        effectiveAt: "2026-09-09T05:00:00.000Z",
      },
    });
  });

  it("publishes only after a successful make-effective transition", async () => {
    const published: Parameters<typeof documentEffectiveWebhookEvent>[0][] = [];
    const publisher = async (event: ReturnType<typeof documentEffectiveWebhookEvent>) => {
      published.push({
        organizationId: event.organizationId,
        documentId: String((event.data as { documentId: string }).documentId),
        versionId: String((event.data as { documentVersionId: string }).documentVersionId),
        occurredAt: event.occurredAt ?? occurredAt,
      });
      return [];
    };
    const service = new DocumentCommandService(store(), () => occurredAt, publisher);

    await service.transition(context, {
      organizationId: "org-1",
      versionId: "version-1",
      command: "MAKE_EFFECTIVE",
      expectedLockVersion: 7,
    });

    expect(published).toEqual([
      {
        organizationId: "org-1",
        documentId: "document-1",
        versionId: "version-1",
        occurredAt,
      },
    ]);
  });

  it("does not publish when the lifecycle store rejects the transition", async () => {
    let publications = 0;
    const publisher = async () => {
      publications += 1;
      return [];
    };
    const service = new DocumentCommandService(store(false), () => occurredAt, publisher);

    await expect(
      service.transition(context, {
        organizationId: "org-1",
        versionId: "version-1",
        command: "MAKE_EFFECTIVE",
        expectedLockVersion: 7,
      }),
    ).rejects.toThrow("changed");
    expect(publications).toBe(0);
  });
});
