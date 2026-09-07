import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { RetentionStore, HoldEntityType, DispositionStatus } from "./service";
import { DispositionBlockedError, RetentionValidationError } from "./service";

export class PrismaRetentionStore implements RetentionStore {
  async list(organizationId: string) {
    const [policies, holds] = await Promise.all([
      db.retentionPolicy.findMany({ where: { organizationId }, orderBy: [{ recordType: "asc" }, { jurisdiction: "asc" }] }),
      db.legalHold.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return { policies, holds };
  }

  async dispositionStatus(input: { organizationId: string; entityType: HoldEntityType; entityId: string; now: Date }): Promise<DispositionStatus> {
    if (input.entityType === "QualityRecord") {
      return qualityRecordDispositionStatus(db, {
        organizationId: input.organizationId,
        entityType: "QualityRecord",
        entityId: input.entityId,
        now: input.now,
      });
    }
    const record = input.entityType === "Document"
      ? await db.document.findFirst({ where: { organizationId: input.organizationId, id: input.entityId }, select: { id: true, createdAt: true } })
      : input.entityType === "DocumentVersion"
        ? await db.documentVersion.findFirst({ where: { organizationId: input.organizationId, id: input.entityId }, select: { id: true, createdAt: true } })
        : await db.fileObject.findFirst({ where: { organizationId: input.organizationId, id: input.entityId }, select: { id: true, createdAt: true } });
    if (!record) throw new Error("Access denied");

    const [holds, policies] = await Promise.all([
      db.legalHold.findMany({ where: { organizationId: input.organizationId, entityType: input.entityType, entityId: input.entityId, status: "ACTIVE" }, select: { id: true } }),
      db.retentionPolicy.findMany({ where: { organizationId: input.organizationId, recordType: input.entityType, active: true }, orderBy: { retentionDays: "desc" }, select: { id: true, retentionDays: true } }),
    ]);
    const retentionEligibleAt = policies.length ? new Date(record.createdAt.getTime() + policies[0]!.retentionDays * 86400000) : null;
    const state = holds.length ? "HELD" : retentionEligibleAt && input.now < retentionEligibleAt ? "RETAINED" : "ELIGIBLE";
    return { entityType: input.entityType, entityId: input.entityId, state, activeHoldIds: holds.map((row) => row.id), retentionPolicyIds: policies.map((row) => row.id), retentionEligibleAt };
  }

  async createPolicy(input: { organizationId: string; recordType: string; jurisdiction: string | null; retentionDays: number; actorUserId: string; occurredAt: Date }) {
    try {
      return await db.$transaction(async (tx) => {
        const policy = await tx.retentionPolicy.create({ data: { organizationId: input.organizationId, recordType: input.recordType, jurisdiction: input.jurisdiction, retentionDays: input.retentionDays } });
        await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "RETENTION_POLICY_CREATED", entityType: "RetentionPolicy", entityId: policy.id, occurredAt: input.occurredAt, metadata: { recordType: input.recordType, jurisdiction: input.jurisdiction, retentionDays: input.retentionDays } as Prisma.InputJsonValue } });
        return { id: policy.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new RetentionValidationError("A matching retention policy already exists");
      throw error;
    }
  }

  async setPolicyActive(input: { organizationId: string; policyId: string; active: boolean; actorUserId: string; occurredAt: Date }) {
    await db.$transaction(async (tx) => {
      const prior = await tx.retentionPolicy.findFirst({ where: { organizationId: input.organizationId, id: input.policyId } });
      if (!prior) throw new Error("Access denied");
      await tx.retentionPolicy.update({ where: { id: prior.id }, data: { active: input.active } });
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "RETENTION_POLICY_STATUS_CHANGED", entityType: "RetentionPolicy", entityId: prior.id, occurredAt: input.occurredAt, metadata: { priorActive: prior.active, active: input.active } as Prisma.InputJsonValue } });
    });
  }

  async createHold(input: { organizationId: string; entityType: HoldEntityType; entityId: string; reason: string; actorUserId: string; occurredAt: Date }) {
    return db.$transaction(async (tx) => {
      const exists = input.entityType === "Document"
        ? await tx.document.findFirst({ where: { organizationId: input.organizationId, id: input.entityId }, select: { id: true } })
        : input.entityType === "DocumentVersion"
          ? await tx.documentVersion.findFirst({ where: { organizationId: input.organizationId, id: input.entityId }, select: { id: true } })
          : input.entityType === "FileObject"
            ? await tx.fileObject.findFirst({ where: { organizationId: input.organizationId, id: input.entityId }, select: { id: true } })
            : (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
                SELECT "id" FROM "QualityRecord"
                WHERE "organizationId" = ${input.organizationId}::uuid AND "id" = ${input.entityId}::uuid
              `))[0];
      if (!exists) throw new Error("Access denied");
      const duplicate = await tx.legalHold.findFirst({ where: { organizationId: input.organizationId, entityType: input.entityType, entityId: input.entityId, status: "ACTIVE" }, select: { id: true } });
      if (duplicate) throw new RetentionValidationError("An active legal hold already exists for this record");
      const hold = await tx.legalHold.create({ data: { organizationId: input.organizationId, entityType: input.entityType, entityId: input.entityId, reason: input.reason, createdByUserId: input.actorUserId, createdAt: input.occurredAt } });
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "LEGAL_HOLD_CREATED", entityType: "LegalHold", entityId: hold.id, occurredAt: input.occurredAt, reason: input.reason, metadata: { heldEntityType: input.entityType, heldEntityId: input.entityId } as Prisma.InputJsonValue } });
      return { id: hold.id };
    });
  }

  async releaseHold(input: { organizationId: string; holdId: string; reason: string; actorUserId: string; occurredAt: Date }) {
    await db.$transaction(async (tx) => {
      const hold = await tx.legalHold.findFirst({ where: { organizationId: input.organizationId, id: input.holdId, status: "ACTIVE" } });
      if (!hold) throw new RetentionValidationError("Active legal hold not found");
      await tx.legalHold.update({ where: { id: hold.id }, data: { status: "RELEASED", releasedByUserId: input.actorUserId, releasedAt: input.occurredAt, releaseReason: input.reason } });
      await tx.auditEvent.create({ data: { organizationId: input.organizationId, actorUserId: input.actorUserId, action: "LEGAL_HOLD_RELEASED", entityType: "LegalHold", entityId: hold.id, occurredAt: input.occurredAt, reason: input.reason, metadata: { heldEntityType: hold.entityType, heldEntityId: hold.entityId } as Prisma.InputJsonValue } });
    });
  }
}

async function qualityRecordDispositionStatus(client: Prisma.TransactionClient | typeof db, input: { organizationId: string; entityType: "QualityRecord"; entityId: string; now: Date }): Promise<DispositionStatus> {
  const records = await client.$queryRaw<Array<{ id: string; createdAt: Date; recordTypeCode: string }>>(Prisma.sql`
    SELECT q."id", q."createdAt", t."code" AS "recordTypeCode"
    FROM "QualityRecord" q
    JOIN "RecordType" t ON t."organizationId" = q."organizationId" AND t."id" = q."recordTypeId"
    WHERE q."organizationId" = ${input.organizationId}::uuid AND q."id" = ${input.entityId}::uuid
  `);
  const record = records[0];
  if (!record) throw new Error("Access denied");
  const [holds, policies] = await Promise.all([
    client.legalHold.findMany({ where: { organizationId: input.organizationId, entityType: "QualityRecord", entityId: input.entityId, status: "ACTIVE" }, select: { id: true } }),
    client.retentionPolicy.findMany({
      where: { organizationId: input.organizationId, active: true, recordType: { in: ["QualityRecord", `QualityRecord:${record.recordTypeCode}`] } },
      orderBy: { retentionDays: "desc" },
      select: { id: true, retentionDays: true },
    }),
  ]);
  const retentionEligibleAt = policies.length ? new Date(record.createdAt.getTime() + policies[0]!.retentionDays * 86400000) : null;
  const state = holds.length ? "HELD" : retentionEligibleAt && input.now < retentionEligibleAt ? "RETAINED" : "ELIGIBLE";
  return { entityType: "QualityRecord", entityId: input.entityId, state, activeHoldIds: holds.map((row) => row.id), retentionPolicyIds: policies.map((row) => row.id), retentionEligibleAt };
}

export async function assertQualityRecordDispositionAllowed(tx: Prisma.TransactionClient, input: { organizationId: string; recordId: string; now: Date }) {
  const status = await qualityRecordDispositionStatus(tx, { organizationId: input.organizationId, entityType: "QualityRecord", entityId: input.recordId, now: input.now });
  if (status.state === "HELD") throw new DispositionBlockedError("Record is under active legal hold");
  if (status.state === "RETAINED") throw new DispositionBlockedError(`Retention period has not expired; disposition eligible ${status.retentionEligibleAt!.toISOString()}`);
  return status;
}

export async function assertFileDispositionAllowed(input: { organizationId: string; fileId: string; now?: Date }) {
  const file = await db.fileObject.findFirst({
    where: { organizationId: input.organizationId, id: input.fileId },
    include: { documentVersions: { select: { id: true, documentId: true } } },
  });
  if (!file) throw new Error("Access denied");
  const versionIds = file.documentVersions.map((row) => row.id), documentIds = [...new Set(file.documentVersions.map((row) => row.documentId))];
  const activeHold = await db.legalHold.findFirst({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      OR: [
        { entityType: "FileObject", entityId: file.id },
        ...(versionIds.length ? [{ entityType: "DocumentVersion", entityId: { in: versionIds } }] : []),
        ...(documentIds.length ? [{ entityType: "Document", entityId: { in: documentIds } }] : []),
      ],
    },
    select: { id: true },
  });
  if (activeHold) throw new DispositionBlockedError("Record is under active legal hold");
  const policy = await db.retentionPolicy.findFirst({ where: { organizationId: input.organizationId, recordType: "FileObject", active: true }, orderBy: { retentionDays: "desc" } });
  if (policy) {
    const eligibleAt = new Date(file.createdAt.getTime() + policy.retentionDays * 86400000);
    if ((input.now ?? new Date()) < eligibleAt) throw new DispositionBlockedError(`Retention period has not expired; disposition eligible ${eligibleAt.toISOString()}`);
  }
  return file;
}
