import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { DocumentReviewService, type ReviewStore } from "./service";

const manager: AuthorizationContext = {
  userId: "manager",
  organizationId: "org-1",
  userState: "ACTIVE",
  grants: [
    {
      permission: "document.review.manage",
      scopeType: "ORGANIZATION",
      scopeId: null,
    },
    {
      permission: "document.review.complete",
      scopeType: "ORGANIZATION",
      scopeId: null,
    },
  ],
};

function fixture() {
  const escalations: number[] = [];
  const reminderKeys: string[] = [];
  let completed = false;
  const overdue = {
    id: "r1",
    documentId: "d1",
    documentVersionId: "v1",
    dueAt: new Date("2026-07-01T00:00:00Z"),
  };
  const upcoming = {
    id: "r2",
    documentId: "d2",
    documentVersionId: "v2",
    dueAt: new Date("2026-09-15T00:00:00Z"),
  };
  const store: ReviewStore = {
    async listDue() {
      return [overdue];
    },
    async listOutstanding(_organizationId, now) {
      return [overdue, upcoming].map((task) => ({
        ...task,
        overdue: task.dueAt < now,
      }));
    },
    async escalate(input) {
      if (escalations.includes(input.level)) return false;
      escalations.push(input.level);
      return true;
    },
    async remind(input) {
      if (reminderKeys.includes(input.eventKey)) return false;
      reminderKeys.push(input.eventKey);
      return true;
    },
    async complete() {
      if (completed) return false;
      completed = true;
      return true;
    },
  };
  return { store, escalations, reminderKeys };
}

describe("periodic document review", () => {
  it("creates idempotent escalation and due-soon reminder events", async () => {
    const f = fixture();
    const service = new DocumentReviewService(
      f.store,
      () => new Date("2026-08-24T00:00:00Z"),
    );
    await expect(service.monitor(manager, "org-1")).resolves.toEqual({
      evaluated: 1,
      escalated: 1,
      reminded: 1,
    });
    await expect(service.monitor(manager, "org-1")).resolves.toEqual({
      evaluated: 1,
      escalated: 0,
      reminded: 0,
    });
    expect(f.escalations).toEqual([3]);
    expect(f.reminderKeys).toEqual(["document-review:r2:due-soon:30"]);
  });

  it("classifies upcoming, due, and overdue review state server-side", async () => {
    const service = new DocumentReviewService(
      fixture().store,
      () => new Date("2026-08-24T00:00:00Z"),
    );
    await expect(service.listOutstanding(manager, "org-1")).resolves.toEqual([
      expect.objectContaining({
        id: "r1",
        reviewState: "OVERDUE",
        overdue: true,
        daysUntilDue: -54,
      }),
      expect.objectContaining({
        id: "r2",
        reviewState: "UPCOMING",
        overdue: false,
        daysUntilDue: 22,
      }),
    ]);
  });

  it("classifies a review due on the current UTC date as DUE", async () => {
    const task = {
      id: "due-today",
      documentId: "d1",
      documentVersionId: "v1",
      dueAt: new Date("2026-08-24T23:59:59Z"),
    };
    const store: ReviewStore = {
      async listDue() {
        return [];
      },
      async listOutstanding() {
        return [{ ...task, overdue: false }];
      },
      async escalate() {
        return false;
      },
      async remind() {
        return false;
      },
      async complete() {
        return true;
      },
    };
    const service = new DocumentReviewService(
      store,
      () => new Date("2026-08-24T08:00:00Z"),
    );
    await expect(service.listOutstanding(manager, "org-1")).resolves.toEqual([
      expect.objectContaining({
        reviewState: "DUE",
        daysUntilDue: 0,
        overdue: false,
      }),
    ]);
  });

  it("blocks cross-tenant review queue access", async () => {
    const service = new DocumentReviewService(
      fixture().store,
      () => new Date("2026-08-24T00:00:00Z"),
    );
    await expect(service.listOutstanding(manager, "org-2")).rejects.toThrow(
      "Access denied",
    );
  });

  it("completes once with a controlled outcome and comments", async () => {
    const service = new DocumentReviewService(fixture().store);
    await expect(
      service.complete(manager, {
        organizationId: "org-1",
        taskId: "r1",
        outcome: "NO_CHANGE",
        comments: "Reviewed; content remains current.",
      }),
    ).resolves.toEqual({ completed: true });
    await expect(
      service.complete(manager, {
        organizationId: "org-1",
        taskId: "r1",
        outcome: "NO_CHANGE",
        comments: "Again",
      }),
    ).rejects.toThrow("changed");
  });

  it("rejects missing rationale", async () => {
    await expect(
      new DocumentReviewService(fixture().store).complete(manager, {
        organizationId: "org-1",
        taskId: "r1",
        outcome: "REVISION_REQUIRED",
        comments: " ",
      }),
    ).rejects.toThrow("required");
  });
});
