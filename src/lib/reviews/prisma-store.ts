import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { ReviewOutcome, ReviewStore } from "./service";

type ReviewRow = {
  id: string;
  documentId: string;
  documentVersionId: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  dueAt: Date;
  assignedToUserId: string | null;
  cycleNumber: number;
};

type CompletionRow = ReviewRow & {
  reviewMonths: number | null;
  versionLockVersion: number;
};

function addMonthsUtc(value: Date, months: number): Date {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export class PrismaReviewStore implements ReviewStore {
  async listDue(organizationId: string, through: Date) {
    return db.$queryRaw<ReviewRow[]>`
      SELECT rt."id", rt."documentId", rt."documentVersionId",
             d."documentNumber", d."title", dv."revisionLabel", rt."dueAt",
             rt."assignedToUserId", rt."cycleNumber"
      FROM "DocumentReviewTask" rt
      JOIN "Document" d
        ON d."organizationId" = rt."organizationId" AND d."id" = rt."documentId"
      JOIN "DocumentVersion" dv
        ON dv."organizationId" = rt."organizationId" AND dv."id" = rt."documentVersionId"
      WHERE rt."organizationId" = CAST(${organizationId} AS uuid)
        AND rt."status" = 'PENDING'
        AND rt."dueAt" <= ${through}
        AND dv."status" = 'EFFECTIVE'
        AND d."currentVersionId" = rt."documentVersionId"
      ORDER BY rt."dueAt" ASC
    `;
  }

  async listOutstanding(organizationId: string, now: Date) {
    const rows = await db.$queryRaw<ReviewRow[]>`
      SELECT rt."id", rt."documentId", rt."documentVersionId",
             d."documentNumber", d."title", dv."revisionLabel", rt."dueAt",
             rt."assignedToUserId", rt."cycleNumber"
      FROM "DocumentReviewTask" rt
      JOIN "Document" d
        ON d."organizationId" = rt."organizationId" AND d."id" = rt."documentId"
      JOIN "DocumentVersion" dv
        ON dv."organizationId" = rt."organizationId" AND dv."id" = rt."documentVersionId"
      WHERE rt."organizationId" = CAST(${organizationId} AS uuid)
        AND rt."status" = 'PENDING'
        AND dv."status" = 'EFFECTIVE'
        AND d."currentVersionId" = rt."documentVersionId"
      ORDER BY rt."dueAt" ASC
    `;
    return rows.map((row) => ({ ...row, overdue: row.dueAt < now }));
  }

  async remind(input: Parameters<ReviewStore["remind"]>[0]) {
    return db.$transaction(async (transaction) => {
      const [task] = await transaction.$queryRaw<ReviewRow[]>`
        SELECT rt."id", rt."documentId", rt."documentVersionId",
               d."documentNumber", d."title", dv."revisionLabel", rt."dueAt",
               rt."assignedToUserId", rt."cycleNumber"
        FROM "DocumentReviewTask" rt
        JOIN "Document" d
          ON d."organizationId" = rt."organizationId" AND d."id" = rt."documentId"
        JOIN "DocumentVersion" dv
          ON dv."organizationId" = rt."organizationId" AND dv."id" = rt."documentVersionId"
        WHERE rt."organizationId" = CAST(${input.organizationId} AS uuid)
          AND rt."id" = CAST(${input.taskId} AS uuid)
          AND rt."status" = 'PENDING'
          AND rt."dueAt" > ${input.occurredAt}
          AND dv."status" = 'EFFECTIVE'
          AND d."currentVersionId" = rt."documentVersionId"
      `;
      if (!task) return false;

      const recipients = await this.recipientIds(
        transaction,
        input.organizationId,
        task.assignedToUserId,
      );
      if (!recipients.length) return false;

      const created = await transaction.notificationOutbox.createMany({
        data: recipients.map((recipientUserId) => ({
          organizationId: input.organizationId,
          recipientUserId,
          eventKey: input.eventKey,
          templateKey: "DOCUMENT_REVIEW_DUE_SOON",
          payload: {
            reviewTaskId: task.id,
            documentId: task.documentId,
            documentVersionId: task.documentVersionId,
            dueAt: task.dueAt.toISOString(),
            cycleNumber: task.cycleNumber,
          },
          availableAt: input.occurredAt,
        })),
        skipDuplicates: true,
      });
      if (!created.count) return false;

      await transaction.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          action: "DOCUMENT_REVIEW_REMINDER_CREATED",
          entityType: "DocumentReviewTask",
          entityId: task.id,
          occurredAt: input.occurredAt,
          metadata: {
            eventKey: input.eventKey,
            dueAt: task.dueAt.toISOString(),
            cycleNumber: task.cycleNumber,
            recipientCount: created.count,
          },
        },
      });
      return true;
    });
  }

  async escalate(input: Parameters<ReviewStore["escalate"]>[0]) {
    try {
      await db.$transaction(async (transaction) => {
        const [task] = await transaction.$queryRaw<ReviewRow[]>`
          SELECT rt."id", rt."documentId", rt."documentVersionId",
                 d."documentNumber", d."title", dv."revisionLabel", rt."dueAt",
                 rt."assignedToUserId", rt."cycleNumber"
          FROM "DocumentReviewTask" rt
          JOIN "Document" d
            ON d."organizationId" = rt."organizationId" AND d."id" = rt."documentId"
          JOIN "DocumentVersion" dv
            ON dv."organizationId" = rt."organizationId" AND dv."id" = rt."documentVersionId"
          WHERE rt."organizationId" = CAST(${input.organizationId} AS uuid)
            AND rt."id" = CAST(${input.taskId} AS uuid)
            AND rt."status" = 'PENDING'
            AND dv."status" = 'EFFECTIVE'
            AND d."currentVersionId" = rt."documentVersionId"
        `;
        if (!task) throw new SkipEscalation();

        await transaction.documentReviewEscalation.create({
          data: {
            organizationId: input.organizationId,
            reviewTaskId: input.taskId,
            level: input.level,
            escalatedAt: input.occurredAt,
          },
        });

        const recipients = await this.recipientIds(
          transaction,
          input.organizationId,
          task.assignedToUserId,
        );
        if (recipients.length)
          await transaction.notificationOutbox.createMany({
            data: recipients.map((recipientUserId) => ({
              organizationId: input.organizationId,
              recipientUserId,
              eventKey: input.eventKey,
              templateKey: "DOCUMENT_REVIEW_OVERDUE",
              payload: {
                reviewTaskId: task.id,
                documentId: task.documentId,
                documentVersionId: task.documentVersionId,
                dueAt: task.dueAt.toISOString(),
                cycleNumber: task.cycleNumber,
                level: input.level,
              },
              availableAt: input.occurredAt,
            })),
          });

        await transaction.auditEvent.create({
          data: {
            organizationId: input.organizationId,
            action: "DOCUMENT_REVIEW_ESCALATED",
            entityType: "DocumentReviewTask",
            entityId: task.id,
            occurredAt: input.occurredAt,
            metadata: {
              level: input.level,
              cycleNumber: task.cycleNumber,
              eventKey: input.eventKey,
            },
          },
        });
      });
      return true;
    } catch (error) {
      if (error instanceof SkipEscalation || isUniqueViolation(error))
        return false;
      throw error;
    }
  }

  async assign(input: Parameters<ReviewStore["assign"]>[0]) {
    return db.$transaction(async (transaction) => {
      const eligible = await transaction.user.findFirst({
        where: {
          organizationId: input.organizationId,
          id: input.assignedToUserId,
          status: "ACTIVE",
          roles: {
            some: {
              role: {
                permissions: {
                  some: { permission: { key: "document.review.complete" } },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!eligible) return false;

      const changed = await transaction.$executeRaw`
        UPDATE "DocumentReviewTask" rt
        SET "assignedToUserId" = CAST(${input.assignedToUserId} AS uuid)
        FROM "Document" d, "DocumentVersion" dv
        WHERE rt."organizationId" = CAST(${input.organizationId} AS uuid)
          AND rt."id" = CAST(${input.taskId} AS uuid)
          AND rt."status" = 'PENDING'
          AND d."organizationId" = rt."organizationId"
          AND d."id" = rt."documentId"
          AND d."currentVersionId" = rt."documentVersionId"
          AND dv."organizationId" = rt."organizationId"
          AND dv."id" = rt."documentVersionId"
          AND dv."status" = 'EFFECTIVE'
      `;
      if (changed !== 1) return false;

      await transaction.notificationOutbox.create({
        data: {
          organizationId: input.organizationId,
          recipientUserId: input.assignedToUserId,
          eventKey: `periodic-review-assigned:${input.taskId}:${input.assignedToUserId}:${input.occurredAt.getTime()}`,
          templateKey: "DOCUMENT_PERIODIC_REVIEW_ASSIGNED",
          payload: { reviewTaskId: input.taskId },
          availableAt: input.occurredAt,
        },
      });
      await transaction.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "PERIODIC_REVIEW_ASSIGNED",
          entityType: "DocumentReviewTask",
          entityId: input.taskId,
          occurredAt: input.occurredAt,
          reason: input.reason,
          metadata: { assignedToUserId: input.assignedToUserId },
        },
      });
      return true;
    });
  }

  async complete(input: Parameters<ReviewStore["complete"]>[0]) {
    try {
      return await db.$transaction(async (transaction) => {
        const [task] = await transaction.$queryRaw<CompletionRow[]>`
          SELECT rt."id", rt."documentId", rt."documentVersionId",
                 d."documentNumber", d."title", dv."revisionLabel", rt."dueAt",
                 rt."assignedToUserId", rt."cycleNumber",
                 dt."reviewMonths", dv."lockVersion" AS "versionLockVersion"
          FROM "DocumentReviewTask" rt
          JOIN "Document" d
            ON d."organizationId" = rt."organizationId" AND d."id" = rt."documentId"
          JOIN "DocumentVersion" dv
            ON dv."organizationId" = rt."organizationId" AND dv."id" = rt."documentVersionId"
          JOIN "DocumentType" dt
            ON dt."organizationId" = d."organizationId" AND dt."id" = d."documentTypeId"
          WHERE rt."organizationId" = CAST(${input.organizationId} AS uuid)
            AND rt."id" = CAST(${input.taskId} AS uuid)
            AND rt."status" = 'PENDING'
            AND rt."assignedToUserId" = CAST(${input.actorUserId} AS uuid)
            AND dv."status" = 'EFFECTIVE'
            AND d."currentVersionId" = rt."documentVersionId"
        `;
        if (!task) return false;

        const changed = await transaction.documentReviewTask.updateMany({
          where: {
            organizationId: input.organizationId,
            id: input.taskId,
            status: "PENDING",
          },
          data: {
            status: "COMPLETED",
            completedAt: input.completedAt,
            completedByUserId: input.actorUserId,
            outcome: input.outcome,
            comments: input.comments,
          },
        });
        if (changed.count !== 1) return false;

        let nextReviewAt: Date | null = null;
        let nextTaskId: string | null = null;
        if (input.outcome === "NO_CHANGE") {
          if (!task.reviewMonths || task.reviewMonths <= 0)
            throw new ReviewCycleConfigurationError();
          nextReviewAt = addMonthsUtc(input.completedAt, task.reviewMonths);
          const versionChanged = await transaction.documentVersion.updateMany({
            where: {
              organizationId: input.organizationId,
              id: task.documentVersionId,
              status: "EFFECTIVE",
              lockVersion: task.versionLockVersion,
            },
            data: {
              reviewDueAt: nextReviewAt,
              lockVersion: { increment: 1 },
            },
          });
          if (versionChanged.count !== 1) throw new ReviewCycleConflict();

          const created = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO "DocumentReviewTask"
              ("organizationId", "documentId", "documentVersionId", "dueAt", "assignedToUserId", "cycleNumber")
            VALUES
              (CAST(${input.organizationId} AS uuid), CAST(${task.documentId} AS uuid),
               CAST(${task.documentVersionId} AS uuid), ${nextReviewAt},
               CAST(${task.assignedToUserId!} AS uuid), ${task.cycleNumber + 1})
            RETURNING "id"
          `;
          nextTaskId = created[0]?.id ?? null;
          if (!nextTaskId) throw new ReviewCycleConflict();

          await transaction.notificationOutbox.create({
            data: {
              organizationId: input.organizationId,
              recipientUserId: task.assignedToUserId!,
              eventKey: `periodic-review-cycle:${nextTaskId}`,
              templateKey: "DOCUMENT_PERIODIC_REVIEW_ASSIGNED",
              payload: {
                reviewTaskId: nextTaskId,
                documentId: task.documentId,
                documentVersionId: task.documentVersionId,
                dueAt: nextReviewAt.toISOString(),
                cycleNumber: task.cycleNumber + 1,
              },
              availableAt: input.completedAt,
            },
          });
        }

        await transaction.auditEvent.create({
          data: {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            action: completionAction(input.outcome),
            entityType: "DocumentReviewTask",
            entityId: input.taskId,
            occurredAt: input.completedAt,
            reason: input.comments,
            metadata: {
              outcome: input.outcome,
              cycleNumber: task.cycleNumber,
              nextReviewAt: nextReviewAt?.toISOString() ?? null,
              nextTaskId,
            },
          },
        });
        return true;
      });
    } catch (error) {
      if (error instanceof ReviewCycleConflict) return false;
      throw error;
    }
  }

  private async recipientIds(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    assignedToUserId: string | null,
  ) {
    const managers = await transaction.user.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        roles: {
          some: {
            role: {
              permissions: {
                some: { permission: { key: "document.review.manage" } },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    return [
      ...new Set([
        ...(assignedToUserId ? [assignedToUserId] : []),
        ...managers.map((manager) => manager.id),
      ]),
    ];
  }
}

class SkipEscalation extends Error {}
class ReviewCycleConflict extends Error {}
class ReviewCycleConfigurationError extends Error {
  constructor() {
    super("A positive review interval is required for the next periodic review cycle");
  }
}

function completionAction(outcome: ReviewOutcome) {
  if (outcome === "NO_CHANGE") return "PERIODIC_REVIEW_COMPLETED_NO_CHANGE";
  if (outcome === "REVISION_REQUIRED") return "PERIODIC_REVIEW_REVISION_REQUIRED";
  return "PERIODIC_REVIEW_RETIRE_SELECTED";
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002",
  );
}
