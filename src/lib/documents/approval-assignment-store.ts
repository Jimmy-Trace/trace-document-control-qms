import { db } from "../db";
import type { ApprovalAssignmentStore } from "./approval-assignment";

export class PrismaApprovalAssignmentStore implements ApprovalAssignmentStore {
  async assign(input: Parameters<ApprovalAssignmentStore["assign"]>[0]) {
    return db.$transaction(async (transaction) => {
      const task = await transaction.workflowTask.findFirst({
        where: {
          id: input.workflowTaskId,
          organizationId: input.organizationId,
          stepKey: "APPROVAL",
          status: { in: ["PENDING", "IN_PROGRESS"] },
          workflow: {
            status: "ACTIVE",
            state: "APPROVAL",
            entityType: "DocumentVersion",
          },
        },
        select: {
          id: true,
          assigneeUserId: true,
          workflow: { select: { entityId: true } },
        },
      });
      if (!task) return false;

      const version = await transaction.documentVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          id: task.workflow.entityId,
          status: "IN_REVIEW",
        },
        select: { authoredByUserId: true },
      });
      if (!version || version.authoredByUserId === input.approverUserId) return false;

      const eligible = await transaction.user.findFirst({
        where: {
          id: input.approverUserId,
          organizationId: input.organizationId,
          status: "ACTIVE",
          roles: {
            some: {
              role: {
                permissions: {
                  some: { permission: { key: "document.approve" } },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!eligible) return false;

      const changed = await transaction.workflowTask.updateMany({
        where: {
          id: task.id,
          organizationId: input.organizationId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          assigneeUserId: task.assigneeUserId,
        },
        data: {
          assigneeUserId: input.approverUserId,
          status: "IN_PROGRESS",
        },
      });
      if (changed.count !== 1) return false;

      await transaction.notificationOutbox.create({
        data: {
          organizationId: input.organizationId,
          recipientUserId: input.approverUserId,
          eventKey: `document-approval-assigned:${task.id}:${input.approverUserId}`,
          templateKey: "DOCUMENT_APPROVAL_ASSIGNED",
          payload: {
            taskId: task.id,
            documentVersionId: task.workflow.entityId,
          },
        },
      });
      await transaction.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "DOCUMENT_APPROVAL_ASSIGNED",
          entityType: "WorkflowTask",
          entityId: task.id,
          reason: input.reason,
          occurredAt: input.occurredAt,
          metadata: {
            documentVersionId: task.workflow.entityId,
            previousAssigneeUserId: task.assigneeUserId,
            approverUserId: input.approverUserId,
          },
        },
      });
      return true;
    });
  }
}
