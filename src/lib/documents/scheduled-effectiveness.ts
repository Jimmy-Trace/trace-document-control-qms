import { db } from "@/lib/db";
import {
  requireAuthorization,
  type AuthorizationContext,
} from "@/lib/security/authorization";

export interface ScheduleEffectivenessInput {
  organizationId: string;
  versionId: string;
  expectedLockVersion: number;
  effectiveAt: Date;
  reason: string;
}

export class ScheduledEffectivenessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduledEffectivenessError";
  }
}

export class ScheduledEffectivenessConcurrencyError extends Error {
  constructor() {
    super("The document changed before the scheduled-effectiveness action completed");
    this.name = "ScheduledEffectivenessConcurrencyError";
  }
}

export function validateScheduledEffectiveAt(effectiveAt: Date, now: Date): void {
  if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() <= now.getTime()) {
    throw new ScheduledEffectivenessError(
      "The scheduled effective date must be in the future",
    );
  }
}

export function addMonthsUtc(value: Date, months: number): Date {
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

export async function scheduleDocumentEffectiveness(
  context: AuthorizationContext,
  input: ScheduleEffectivenessInput,
  clock: () => Date = () => new Date(),
) {
  requireAuthorization(context, {
    organizationId: input.organizationId,
    permission: "document.make_effective",
  });
  const occurredAt = clock();
  validateScheduledEffectiveAt(input.effectiveAt, occurredAt);
  if (!input.reason.trim()) {
    throw new ScheduledEffectivenessError("A scheduling reason is required");
  }

  return db.$transaction(async (transaction) => {
    const version = await transaction.documentVersion.findFirst({
      where: {
        organizationId: input.organizationId,
        id: input.versionId,
      },
      select: {
        id: true,
        documentId: true,
        status: true,
        lockVersion: true,
        effectiveAt: true,
      },
    });
    if (!version) throw new Error("Access denied");
    if (version.status !== "APPROVED") {
      throw new ScheduledEffectivenessError(
        "Only an approved document version can be scheduled for effectiveness",
      );
    }
    if (version.lockVersion !== input.expectedLockVersion) {
      throw new ScheduledEffectivenessConcurrencyError();
    }

    const changed = await transaction.documentVersion.updateMany({
      where: {
        organizationId: input.organizationId,
        id: input.versionId,
        status: "APPROVED",
        lockVersion: input.expectedLockVersion,
      },
      data: {
        effectiveAt: input.effectiveAt,
        lockVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ScheduledEffectivenessConcurrencyError();

    await transaction.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: context.userId,
        action: "DOCUMENT_EFFECTIVENESS_SCHEDULED",
        entityType: "DocumentVersion",
        entityId: input.versionId,
        occurredAt,
        reason: input.reason.trim(),
        metadata: {
          documentId: version.documentId,
          scheduledEffectiveAt: input.effectiveAt.toISOString(),
          previousEffectiveAt: version.effectiveAt?.toISOString() ?? null,
          priorLockVersion: input.expectedLockVersion,
        },
      },
    });

    return {
      id: input.versionId,
      documentId: version.documentId,
      status: version.status,
      effectiveAt: input.effectiveAt,
      lockVersion: input.expectedLockVersion + 1,
    };
  });
}

async function activateScheduledVersion(
  organizationId: string,
  versionId: string,
  processedAt: Date,
): Promise<boolean> {
  try {
    return await db.$transaction(async (transaction) => {
      const version = await transaction.documentVersion.findFirst({
        where: {
          organizationId,
          id: versionId,
          status: "APPROVED",
          effectiveAt: { lte: processedAt },
        },
        select: {
          id: true,
          documentId: true,
          lockVersion: true,
          effectiveAt: true,
          document: {
            select: {
              currentVersionId: true,
              lifecycleState: true,
              documentType: { select: { reviewMonths: true } },
            },
          },
        },
      });
      if (!version?.effectiveAt) return false;
      if (version.document.lifecycleState !== "ACTIVE") return false;

      const reviewMonths = version.document.documentType.reviewMonths;
      if (!reviewMonths || reviewMonths <= 0) {
        throw new ScheduledEffectivenessError(
          "A positive review interval is required before a document can become effective",
        );
      }

      const scheduledAt = version.effectiveAt;
      const currentVersionId = version.document.currentVersionId;
      if (currentVersionId && currentVersionId !== version.id) {
        await transaction.documentReviewTask.updateMany({
          where: {
            organizationId,
            documentVersionId: currentVersionId,
            status: "PENDING",
          },
          data: { status: "CANCELLED" },
        });
        const superseded = await transaction.documentVersion.updateMany({
          where: {
            organizationId,
            id: currentVersionId,
            status: "EFFECTIVE",
          },
          data: {
            status: "SUPERSEDED",
            supersededAt: scheduledAt,
            lockVersion: { increment: 1 },
          },
        });
        if (superseded.count !== 1) return false;
      }

      const reviewDueAt = addMonthsUtc(scheduledAt, reviewMonths);
      const changed = await transaction.documentVersion.updateMany({
        where: {
          organizationId,
          id: version.id,
          status: "APPROVED",
          lockVersion: version.lockVersion,
          effectiveAt: scheduledAt,
        },
        data: {
          status: "EFFECTIVE",
          reviewDueAt,
          lockVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) return false;

      const documentChanged = await transaction.document.updateMany({
        where: {
          organizationId,
          id: version.documentId,
          lifecycleState: "ACTIVE",
        },
        data: {
          currentVersionId: version.id,
          lifecycleState: "ACTIVE",
        },
      });
      if (documentChanged.count !== 1) return false;

      await transaction.documentReviewTask.create({
        data: {
          organizationId,
          documentId: version.documentId,
          documentVersionId: version.id,
          dueAt: reviewDueAt,
        },
      });

      await transaction.auditEvent.create({
        data: {
          organizationId,
          actorUserId: null,
          action: "DOCUMENT_VERSION_MAKE_EFFECTIVE",
          entityType: "DocumentVersion",
          entityId: version.id,
          occurredAt: processedAt,
          reason: "Scheduled effective date reached",
          metadata: {
            documentId: version.documentId,
            from: "APPROVED",
            to: "EFFECTIVE",
            scheduledEffectiveAt: scheduledAt.toISOString(),
            processedAt: processedAt.toISOString(),
            priorLockVersion: version.lockVersion,
            automated: true,
          },
        },
      });

      return true;
    });
  } catch (error) {
    if (error instanceof ScheduledEffectivenessError) throw error;
    return false;
  }
}

export async function processScheduledEffectiveness(
  now: Date = new Date(),
  limit = 100,
): Promise<{ processed: number; skipped: number; failed: number }> {
  const due = await db.documentVersion.findMany({
    where: {
      status: "APPROVED",
      effectiveAt: { lte: now },
    },
    orderBy: { effectiveAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: { organizationId: true, id: true },
  });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidate of due) {
    try {
      if (
        await activateScheduledVersion(
          candidate.organizationId,
          candidate.id,
          now,
        )
      ) {
        processed += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      if (error instanceof ScheduledEffectivenessError) {
        failed += 1;
        continue;
      }
      throw error;
    }
  }
  return { processed, skipped, failed };
}
