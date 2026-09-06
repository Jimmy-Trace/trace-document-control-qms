import { describe, expect, it } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import {
  ApprovalAssignmentConflictError,
  ApprovalAssignmentService,
  type ApprovalAssignmentStore,
} from "./approval-assignment";

const context: AuthorizationContext = {
  userId: "manager-1",
  organizationId: "org-1",
  userState: "ACTIVE",
  grants: [
    {
      permission: "document.review.manage",
      scopeType: "ORGANIZATION",
      scopeId: null,
    },
  ],
};
const submitterContext: AuthorizationContext = {
  userId: "owner-1",
  organizationId: "org-1",
  userState: "ACTIVE",
  grants: [
    {
      permission: "document.submit",
      scopeType: "ORGANIZATION",
      scopeId: null,
    },
  ],
};

function fixture(changed = true) {
  const calls: unknown[] = [];
  const store: ApprovalAssignmentStore = {
    async list() {
      return {
        tasks: [
          {
            id: "task-1",
            documentVersionId: "version-1",
            documentNumber: "SOP-001",
            title: "Controlled SOP",
            revisionLabel: "1.0",
            assigneeUserId: null,
          },
        ],
        approvers: [{ id: "approver-1", name: "Approver One" }],
      };
    },
    async assign(input) {
      calls.push(input);
      return changed;
    },
  };
  return { store, calls };
}

describe("controlled approval assignment", () => {
  it("lists assignable tasks through the review-management boundary", async () => {
    await expect(
      new ApprovalAssignmentService(fixture().store).list(context, "org-1"),
    ).resolves.toMatchObject({
      tasks: [{ id: "task-1" }],
      approvers: [{ id: "approver-1" }],
    });
  });

  it("exposes only eligible approver options to an authorized submitter", async () => {
    await expect(
      new ApprovalAssignmentService(fixture().store).listApprovers(
        submitterContext,
        "org-1",
      ),
    ).resolves.toEqual({
      approvers: [{ id: "approver-1", name: "Approver One" }],
    });
  });

  it("binds the assignment to the authenticated manager and trims the reason", async () => {
    const f = fixture();
    await expect(
      new ApprovalAssignmentService(
        f.store,
        () => new Date("2026-09-06T00:00:00Z"),
      ).assign(context, {
        organizationId: "org-1",
        workflowTaskId: "task-1",
        approverUserId: "approver-1",
        reason: " Final approval coverage ",
      }),
    ).resolves.toEqual({ assigned: true });
    expect(f.calls[0]).toMatchObject({
      actorUserId: "manager-1",
      approverUserId: "approver-1",
      reason: "Final approval coverage",
    });
  });

  it("rejects self-assignment and blank reasons", async () => {
    const service = new ApprovalAssignmentService(fixture().store);
    await expect(
      service.assign(context, {
        organizationId: "org-1",
        workflowTaskId: "task-1",
        approverUserId: "manager-1",
        reason: "Valid",
      }),
    ).rejects.toThrow("different approver");
    await expect(
      service.assign(context, {
        organizationId: "org-1",
        workflowTaskId: "task-1",
        approverUserId: "approver-1",
        reason: " ",
      }),
    ).rejects.toThrow("reason");
  });

  it("rejects stale or ineligible approval tasks", async () => {
    await expect(
      new ApprovalAssignmentService(fixture(false).store).assign(context, {
        organizationId: "org-1",
        workflowTaskId: "task-1",
        approverUserId: "approver-1",
        reason: "Controlled assignment",
      }),
    ).rejects.toBeInstanceOf(ApprovalAssignmentConflictError);
  });
});
