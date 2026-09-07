import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { QualityRecord, RecordStore, RecordTypeRecord } from "./records";
import { RecordEligibilityError } from "./records";

export class PrismaRecordStore implements RecordStore {
  async createType(input: {
    organizationId: string;
    code: string;
    name: string;
    description: string | null;
    actorUserId: string;
  }): Promise<RecordTypeRecord> {
    return db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RecordTypeRecord[]>(Prisma.sql`
        INSERT INTO "RecordType" ("organizationId", "code", "name", "description")
        VALUES (${input.organizationId}::uuid, ${input.code}, ${input.name}, ${input.description})
        RETURNING *
      `);
      const row = rows[0];
      if (!row) throw new Error("Record type could not be created");
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "RECORD_TYPE_CREATED",
        entityType: "RecordType",
        entityId: row.id,
        entityVersion: row.code,
        metadata: { code: row.code, name: row.name },
      }});
      return row;
    });
  }

  async listTypes(organizationId: string): Promise<RecordTypeRecord[]> {
    return db.$queryRaw<RecordTypeRecord[]>(Prisma.sql`
      SELECT * FROM "RecordType"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "name" ASC
    `);
  }

  async createRecord(input: {
    organizationId: string;
    recordTypeId: string;
    recordNumber: string;
    title: string;
    occurredAt: Date | null;
    fileId: string | null;
    actorUserId: string;
  }): Promise<QualityRecord> {
    return db.$transaction(async (tx) => {
      const types = await tx.$queryRaw<Array<{ id: string; active: boolean }>>(Prisma.sql`
        SELECT "id", "active"
        FROM "RecordType"
        WHERE "organizationId" = ${input.organizationId}::uuid
          AND "id" = ${input.recordTypeId}::uuid
        FOR SHARE
      `);
      if (!types[0]?.active) throw new RecordEligibilityError("Record type is inactive or unavailable");

      if (input.fileId) {
        const files = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
          SELECT "id", "status"::text AS "status"
          FROM "FileObject"
          WHERE "organizationId" = ${input.organizationId}::uuid
            AND "id" = ${input.fileId}::uuid
          FOR SHARE
        `);
        if (files[0]?.status !== "AVAILABLE") throw new RecordEligibilityError("Record file is not available");
      }

      const rows = await tx.$queryRaw<QualityRecord[]>(Prisma.sql`
        INSERT INTO "QualityRecord" (
          "organizationId", "recordTypeId", "recordNumber", "title", "occurredAt", "fileId", "createdByUserId"
        ) VALUES (
          ${input.organizationId}::uuid, ${input.recordTypeId}::uuid, ${input.recordNumber}, ${input.title},
          ${input.occurredAt}, ${input.fileId}::uuid, ${input.actorUserId}::uuid
        )
        RETURNING *
      `);
      const row = rows[0];
      if (!row) throw new Error("Quality record could not be created");
      await tx.auditEvent.create({ data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "QUALITY_RECORD_CREATED",
        entityType: "QualityRecord",
        entityId: row.id,
        entityVersion: row.recordNumber,
        metadata: {
          recordTypeId: row.recordTypeId,
          recordNumber: row.recordNumber,
          title: row.title,
          occurredAt: row.occurredAt?.toISOString() ?? null,
          fileId: row.fileId,
        },
      }});
      return row;
    });
  }

  async listRecords(organizationId: string): Promise<QualityRecord[]> {
    return db.$queryRaw<QualityRecord[]>(Prisma.sql`
      SELECT * FROM "QualityRecord"
      WHERE "organizationId" = ${organizationId}::uuid
      ORDER BY "createdAt" DESC
      LIMIT 250
    `);
  }
}
